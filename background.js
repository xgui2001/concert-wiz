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
        url: `https://www.ticketmaster.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      });
    }
    
    // SeatGeek functionality - commented out until you're ready to implement it
    /*
    // When you're ready to implement SeatGeek:
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
      url: `https://seatgeek.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
    });
    
    // StubHub fallback
    allTickets.push({
      platform: 'StubHub',
      price: 'Check site',
      venue: 'Search results',
      date: date || '',
      url: `https://www.stubhub.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
    });
    
    // VividSeats fallback
    allTickets.push({
      platform: 'VividSeats',
      price: 'Check site',
      venue: 'Search results',
      date: date || '',
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
        url: `https://www.ticketmaster.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      },
      {
        platform: 'SeatGeek',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        url: `https://seatgeek.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      },
      {
        platform: 'StubHub',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        url: `https://www.stubhub.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      },
      {
        platform: 'VividSeats',
        price: 'Check site',
        venue: 'Search results',
        date: date || '',
        url: `https://www.vividseats.com/search?q=${encodeURIComponent(artist)}${location ? `+${encodeURIComponent(location)}` : ''}`
      }
    ];
  }
  
  return allTickets;
}