// Ticketmaster API service

/**
 * Search for events on Ticketmaster using their Discovery API
 * @param {string} artist - Artist or event name
 * @param {string} date - Event date in YYYY-MM-DD format (optional)
 * @param {string} location - City or venue name (optional)
 * @param {string} apiKey - Your Ticketmaster API key
 * @returns {Promise<Array>} - Array of ticket objects
 */
export async function searchTicketmaster(artist, date, location, apiKey) {
  try {
    if (!apiKey) {
      console.error('Ticketmaster API key not provided');
      return [];
    }
    
    // Build base URL with required parameters
    let url = `https://app.ticketmaster.com/discovery/v2/events.json?keyword=${encodeURIComponent(artist)}&apikey=${apiKey}`;
    
    // Add location filtering if provided - with improved handling
    if (location && location.trim() !== '') {
      // Try to determine if it's a city, state, or venue
      const locationTerm = location.trim();
      
      // Check if it might be a US state code (2 letters)
      const isStateCode = /^[A-Za-z]{2}$/.test(locationTerm);
      
      // Check if it might be a postal code (5-10 digits/letters)
      const isPostalCode = /^[0-9A-Za-z]{5,10}$/.test(locationTerm);
      
      if (isStateCode) {
        // If it looks like a state code, use stateCode parameter
        url += `&stateCode=${encodeURIComponent(locationTerm.toUpperCase())}`;
      } else if (isPostalCode) {
        // If it looks like a postal code, use postalCode parameter
        url += `&postalCode=${encodeURIComponent(locationTerm)}`;
      } else {
        // Otherwise assume it's a city name
        url += `&city=${encodeURIComponent(locationTerm)}`;
        
        // Also add a countryCode parameter defaulting to US but allowing for other formats
        // This helps with international searches
        if (locationTerm.includes(',')) {
          // Format might be "City, Country" or "City, State, Country"
          const parts = locationTerm.split(',').map(p => p.trim());
          if (parts.length > 1 && parts[1].length === 2) {
            url += `&countryCode=${encodeURIComponent(parts[1].toUpperCase())}`;
          }
        }
      }
    }
    
    // FIXED DATE HANDLING
    if (date && date.trim() !== '') {
      try {
        // Parse the input date string - ensure it's in YYYY-MM-DD format
        let dateStr = date.trim();
        
        // Create a date object - this will handle different input formats
        const dateObj = new Date(dateStr);
        
        // Validate that we have a proper date
        if (!isNaN(dateObj.getTime())) {
          // Format to YYYY-MM-DD for consistency
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          
          // Create properly formatted date strings for API
          // The API requires ISO8601 format
          const startDateStr = `${year}-${month}-${day}T00:00:00Z`;  
          const endDateStr = `${year}-${month}-${day}T23:59:59Z`;
          
          url += `&startDateTime=${encodeURIComponent(startDateStr)}`;
          url += `&endDateTime=${encodeURIComponent(endDateStr)}`;
          
          console.log(`Searching for events between ${startDateStr} and ${endDateStr}`);
        } else {
          console.warn(`Invalid date format provided: ${date}`);
        }
      } catch (error) {
        console.error('Error processing date:', error);
        // Continue without date filter if there's an error
      }
    }
    
    // Add sorting by date
    url += '&sort=date,asc';
    
    // Add size parameter to get more results (max is 200)
    url += '&size=50';
    
    // Make the API request
    console.log(`Searching Ticketmaster with URL: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check if events were found
    if (!data._embedded || !data._embedded.events || data._embedded.events.length === 0) {
      console.log('No events found on Ticketmaster');
      return [];
    }
    
    // Parse and format the results
    return data._embedded.events.map(event => {
      // Extract venue and location information
      const venueData = event._embedded?.venues?.[0];
      const venueName = venueData?.name || 'Venue TBA';
      const city = venueData?.city?.name || '';
      const state = venueData?.state?.stateCode || '';
      const country = venueData?.country?.countryCode || '';
      
      // Format the venue location with all available info
      let venueLocation = venueName;
      if (city) {
        venueLocation += `, ${city}`;
        if (state) {
          venueLocation += `, ${state}`;
        }
        if (country && country !== 'US') {
          venueLocation += `, ${country}`;
        }
      }
      
      // Extract price information if available
      let price = null;
      if (event.priceRanges && event.priceRanges.length > 0) {
        // Use minimum price from price ranges
        price = event.priceRanges[0].min;
      }
      
      // Extract coordinates for venue if available (for location-based sorting)
      let coordinates = null;
      if (venueData?.location) {
        coordinates = {
          lat: parseFloat(venueData.location.latitude),
          lng: parseFloat(venueData.location.longitude)
        };
      }
      
      // Extract date and time information with better formatting
      let rawDate = '';
      let displayDate = 'Date TBA';
      
      if (event.dates?.start?.localDate) {
        // Store raw date for sorting and filtering
        rawDate = event.dates.start.localDate;
        
        try {
          // Create a properly formatted date object
          const dateObj = new Date(rawDate);
          
          if (!isNaN(dateObj.getTime())) {
            // Format date in a user-friendly way
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
            displayDate = dateObj.toLocaleDateString('en-US', options);
            
            // Add time if available
            if (event.dates.start.localTime) {
              try {
                const timeObj = new Date(`${rawDate}T${event.dates.start.localTime}`);
                if (!isNaN(timeObj.getTime())) {
                  displayDate += ` at ${timeObj.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}`;
                }
              } catch (timeError) {
                console.warn('Error formatting time:', timeError);
              }
            }
          }
        } catch (dateError) {
          console.warn('Error formatting date:', dateError);
          displayDate = rawDate; // Fallback to raw date
        }
      }
      
      return {
        platform: 'Ticketmaster',
        price: price !== null ? price : 'Check site',
        venue: venueLocation,
        date: displayDate,
        rawDate: rawDate, // Keep the raw date for sorting
        url: event.url,
        // Include additional information that might be useful
        name: event.name,
        id: event.id,
        coordinates: coordinates,
        imageUrl: event.images && event.images.length > 0 ? event.images[0].url : null
      };
    });
  } catch (error) {
    console.error('Error searching Ticketmaster API:', error);
    // Return empty array on error
    return [];
  }
}