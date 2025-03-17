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
    
    // Add date filtering if provided - with improved handling
    if (date && date.trim() !== '') {
      // Format the start date for the API - start at beginning of the day
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      // For specific date searches, only search for events on that exact date
      // by setting endDateTime to the end of the same day
      const endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      
      url += `&startDateTime=${startDate.toISOString().split('.')[0]}Z`;
      url += `&endDateTime=${endDate.toISOString().split('.')[0]}Z`;
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
      
      // Extract date and time information with better formatting
      let eventDate = '';
      let displayDate = '';
      if (event.dates?.start?.localDate) {
        eventDate = event.dates.start.localDate;
        
        // Create a formatted date for display
        const dateObj = new Date(event.dates.start.localDate);
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        displayDate = dateObj.toLocaleDateString('en-US', options);
        
        // Add time if available
        if (event.dates.start.localTime) {
          const timeObj = new Date(`${event.dates.start.localDate}T${event.dates.start.localTime}`);
          displayDate += ` at ${timeObj.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}`;
        }
      }
      
      return {
        platform: 'Ticketmaster',
        price: price !== null ? price : 'Check site',
        venue: venueLocation,
        date: displayDate || eventDate || 'Date TBA',
        rawDate: eventDate, // Keep the raw date for sorting
        url: event.url,
        // Include additional information that might be useful
        name: event.name,
        id: event.id,
        imageUrl: event.images && event.images.length > 0 ? event.images[0].url : null
      };
    });
  } catch (error) {
    console.error('Error searching Ticketmaster API:', error);
    // Return empty array on error
    return [];
  }
}