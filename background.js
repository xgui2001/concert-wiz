// Background script with Ticketmaster API integration
// Import API keys and Ticketmaster service
import API_KEYS, { CONSUMER_SECRET } from './api-keys.js';
import { searchTicketmaster } from './ticketmaster-service.js';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchTickets') {
    searchAllPlatforms(request.data)
      .then(tickets => {
        sendResponse({ success: true, tickets });
      })
      .catch(error => {
        console.error('Error searching for tickets:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

// Set up periodic checking for tracked events
chrome.alarms.create('checkPrices', { periodInMinutes: 720 }); // Check every 12 hours

// Listen for the alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkPrices') {
    checkTrackedEventPrices();
  }
});

// Function to check prices for all tracked events
async function checkTrackedEventPrices() {
  try {
    // Get all tracked events from storage
    const result = await chrome.storage.local.get('trackedConcerts');
    const trackedConcerts = result.trackedConcerts || [];
    
    if (trackedConcerts.length === 0) {
      console.log('No tracked concerts to check');
      return;
    }
    
    console.log(`Checking prices for ${trackedConcerts.length} tracked concerts`);
    
    // Check each concert (with a small delay between requests to avoid rate limits)
    for (const concert of trackedConcerts) {
      try {
        // Check if the concert date has passed
        if (concert.rawDate) {
          const eventDate = new Date(concert.rawDate);
          const now = new Date();
          
          // If the concert date has passed, skip it
          if (eventDate < now) {
            console.log(`Skipping past concert: ${concert.name} on ${concert.formattedDate}`);
            continue;
          }
        }
        
        // Search for updated prices
        const tickets = await searchAllPlatforms({
          artist: concert.name,
          date: concert.rawDate,
          location: concert.venue
        });
        
        // Find matching ticket
        const matchingTicket = tickets.find(ticket => {
          return ticket.platform === concert.platform &&
                 ticket.name === concert.name &&
                 ticket.venue === concert.venue;
        });
        
        if (matchingTicket && typeof matchingTicket.price === 'number') {
          // Check if price has changed
          const latestPrice = concert.priceHistory[concert.priceHistory.length - 1].price;
          
          if (latestPrice !== matchingTicket.price) {
            // Add new price to history
            concert.priceHistory.push({
              date: new Date().toISOString(),
              price: matchingTicket.price
            });
            
            // Update last checked time
            concert.lastChecked = new Date().toISOString();
            
            console.log(`Price updated for ${concert.name}: $${latestPrice} -> $${matchingTicket.price}`);
            
            // Check if we should send a notification for significant price changes
            const priceDifference = matchingTicket.price - latestPrice;
            const percentChange = (priceDifference / latestPrice) * 100;
            
            // Notify if price drop or significant increase (>10%)
            if (priceDifference < 0 || Math.abs(percentChange) > 10) {
              const changeType = priceDifference < 0 ? 'dropped' : 'increased';
              const changeAmount = Math.abs(priceDifference).toFixed(2);
              const changePercent = Math.abs(percentChange).toFixed(1);
              
              // Create notification
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'images/icon-128.png',
                title: `Concert Price ${changeType.charAt(0).toUpperCase() + changeType.slice(1)}!`,
                message: `${concert.name} tickets have ${changeType} by $${changeAmount} (${changePercent}%)`,
                contextMessage: `Current price: $${matchingTicket.price.toFixed(2)}`,
                priority: 1
              });
            }
          } else {
            // Just update the last checked time
            concert.lastChecked = new Date().toISOString();
            console.log(`No price change for ${concert.name}: still $${latestPrice}`);
          }
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error checking prices for ${concert.name}:`, error);
      }
    }
    
    // Save updated tracked concerts
    await chrome.storage.local.set({ 'trackedConcerts': trackedConcerts });
    console.log('Finished checking all tracked concert prices');
    
  } catch (error) {
    console.error('Error during price check:', error);
  }
}

// Main function to search all platforms
async function searchAllPlatforms(searchData) {
  const { artist, date, location } = searchData;
  
  // Array to store all ticket results
  let allTickets = [];
  
  try {
    // Start with Ticketmaster since we have the API integration ready
    console.log(`Searching for: ${artist}, Date: ${date || 'any'}, Location: ${location || 'any'}`);
    
    // Call Ticketmaster API with our API key (using static import)
    const ticketmasterResults = await searchTicketmaster(
      artist, 
      date, 
      location, 
      API_KEYS.TICKETMASTER
    );
    
    if (ticketmasterResults && ticketmasterResults.length > 0) {
      console.log(`Found ${ticketmasterResults.length} events on Ticketmaster`);
      allTickets = [...allTickets, ...ticketmasterResults];
    } else {
      console.log('No events found on Ticketmaster');
      // Add a fallback search link if no results are found
      allTickets.push({
        platform: 'Ticketmaster',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        rawDate: date || '',
        url: `https://www.ticketmaster.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      });
    }
    
    // SeatGeek functionality - NOT IMPLEMENTED
    /*
    // When api is ready:
    // 1. Uncomment this code
    // 2. Add "import { searchSeatGeek } from './seatgeek-service.js';" at the top of this file
    const seatGeekResults = await searchSeatGeek(
      artist,
      date,
      location,
      API_KEYS.SEATGEEK
    );
    
    if (seatGeekResults && seatGeekResults.length > 0) {
      console.log(`Found ${seatGeekResults.length} events on SeatGeek`);
      allTickets = [...allTickets, ...seatGeekResults];
    } else {
      console.log('No events found on SeatGeek');
      // Add a fallback search link if no results are found
      allTickets.push({
        platform: 'SeatGeek',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        rawDate: date || '',
        url: `https://seatgeek.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      });
    }
    */
    
    // Add fallback for SeatGeek
    allTickets.push({
      platform: 'SeatGeek',
      price: 'Check site',
      venue: 'Search results',
      date: date || '',
      rawDate: date || '',
      url: `https://seatgeek.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
    });
    
    // StubHub fallback
    allTickets.push({
      platform: 'StubHub',
      price: 'Check site',
      venue: 'Search results',
      date: date || '',
      rawDate: date || '',
      url: `https://www.stubhub.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
    });
    
    // VividSeats fallback
    allTickets.push({
      platform: 'VividSeats',
      price: 'Check site',
      venue: 'Search results',
      date: date || '',
      rawDate: date || '',
      url: `https://www.vividseats.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
    });
    
  } catch (error) {
    console.error('Error in searchAllPlatforms:', error);
    
    // Return basic fallbacks if there's an error
    allTickets = [
      {
        platform: 'Ticketmaster',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        rawDate: date || '',
        url: `https://www.ticketmaster.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      },
      {
        platform: 'SeatGeek',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        rawDate: date || '',
        url: `https://seatgeek.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      },
      {
        platform: 'StubHub',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        rawDate: date || '',
        url: `https://www.stubhub.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      },
      {
        platform: 'VividSeats',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        rawDate: date || '',
        url: `https://www.vividseats.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      }
    ];
  }
  
  return allTickets;
}