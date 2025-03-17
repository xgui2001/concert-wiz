document.addEventListener('DOMContentLoaded', function() {
  const searchForm = document.getElementById('search-form');
  const loadingElement = document.getElementById('loading');
  const resultsElement = document.getElementById('results');
  const errorElement = document.getElementById('error');
  const ticketsContainer = document.getElementById('tickets-container');
  
  // Added elements for tracking functionality
  let trackedEvents = [];
  let currentTickets = [];
  let currentSortOption = 'price'; // Default sort option
  
  // Load tracked events on popup open
  loadTrackedEvents();
  
  searchForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    // Get form values
    const artist = document.getElementById('artist').value.trim();
    const rawDate = document.getElementById('date').value;
    const location = document.getElementById('location').value.trim();
    
    // Format date properly for API request
    const formattedDate = formatDateForApi(rawDate);
    
    // Show loading, hide results and error
    loadingElement.classList.remove('hidden');
    resultsElement.classList.add('hidden');
    errorElement.classList.add('hidden');
    
    // Send message to background script to start the search
    chrome.runtime.sendMessage({
      action: 'searchTickets',
      data: {
        artist,
        date: formattedDate, // Using the properly formatted date
        location
      }
    }, function(response) {
      // Hide loading
      loadingElement.classList.add('hidden');
      
      if (response && response.success && response.tickets && response.tickets.length > 0) {
        // Store current tickets for sorting
        currentTickets = response.tickets;
        
        // Add search timestamp to know when prices were checked
        currentTickets.forEach(ticket => {
          ticket.lastChecked = new Date().toISOString();
        });
        
        // Show results sorted by the current sort option
        sortAndDisplayResults();
        resultsElement.classList.remove('hidden');
        
        // Show sort options
        document.getElementById('sort-options').classList.remove('hidden');
      } else {
        // Show error
        errorElement.classList.remove('hidden');
      }
    });
  });
  
  /**
   * Formats a date from input field for API requests
   * @param {string} inputDateValue - Value from date input field
   * @returns {string} - Properly formatted date string
   */
  function formatDateForApi(inputDateValue) {
    if (!inputDateValue) return '';
    
    try {
      // Create a date object from input value
      const date = new Date(inputDateValue);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn(`Invalid input date: ${inputDateValue}`);
        return '';
      }
      
      // Format to YYYY-MM-DD for API requests
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date for API:', error);
      return '';
    }
  }
  
  // Add event listeners for sort buttons
  document.getElementById('sort-price').addEventListener('click', function() {
    currentSortOption = 'price';
    sortAndDisplayResults();
  });
  
  document.getElementById('sort-date').addEventListener('click', function() {
    currentSortOption = 'date';
    sortAndDisplayResults();
  });
  
  document.getElementById('sort-location').addEventListener('click', function() {
    currentSortOption = 'location';
    
    // If we need the user's location for this sort
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function(position) {
          // Store current position for sorting
          window.currentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          sortAndDisplayResults();
        },
        function(error) {
          console.error("Error getting location:", error);
          // Fall back to price sort if location not available
          currentSortOption = 'price';
          sortAndDisplayResults();
        }
      );
    } else {
      console.log("Geolocation not supported by this browser");
      // Fall back to price sort
      currentSortOption = 'price';
      sortAndDisplayResults();
    }
  });
  
  function sortAndDisplayResults() {
    let sortedTickets = [...currentTickets]; // Create a copy for sorting
    
    // Update active sort button UI
    document.querySelectorAll('.sort-button').forEach(btn => {
      btn.classList.remove('active');
    });
    document.getElementById(`sort-${currentSortOption}`).classList.add('active');
    
    // Apply sorting based on current option
    switch (currentSortOption) {
      case 'price':
        // First separate tickets with and without numeric prices
        const ticketsWithPrices = sortedTickets.filter(ticket => typeof ticket.price === 'number');
        const ticketsWithoutPrices = sortedTickets.filter(ticket => typeof ticket.price !== 'number');
        
        // Sort tickets with prices by price (lowest first)
        ticketsWithPrices.sort((a, b) => a.price - b.price);
        
        // Combine sorted arrays
        sortedTickets = [...ticketsWithPrices, ...ticketsWithoutPrices];
        break;
        
      case 'date':
        // Sort by date (closest first)
        sortedTickets.sort((a, b) => {
          // Handle cases where date might be missing
          if (!a.rawDate) return 1;
          if (!b.rawDate) return -1;
          
          const dateA = new Date(a.rawDate);
          const dateB = new Date(b.rawDate);
          
          // Check if dates are valid
          if (isNaN(dateA.getTime())) return 1;
          if (isNaN(dateB.getTime())) return -1;
          
          return dateA - dateB;
        });
        break;
        
      case 'location':
        // Sort by proximity to user's location if available
        if (window.currentPosition) {
          // This is a simplified distance calculation
          // In a real app, you might want to use a more accurate method
          sortedTickets.sort((a, b) => {
            // If venue has coordinates, use them
            if (a.coordinates && b.coordinates) {
              const distA = calculateDistance(
                window.currentPosition.lat, 
                window.currentPosition.lng,
                a.coordinates.lat,
                a.coordinates.lng
              );
              
              const distB = calculateDistance(
                window.currentPosition.lat, 
                window.currentPosition.lng,
                b.coordinates.lat,
                b.coordinates.lng
              );
              
              return distA - distB;
            }
            
            // If no coordinates, keep original order
            return 0;
          });
        }
        break;
    }
    
    // Display the sorted results
    displayResults(sortedTickets);
  }
  
  function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula for calculating distance between two points
    const R = 6371; // Radius of earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  }
  
  function deg2rad(deg) {
    return deg * (Math.PI/180);
  }
  
  function displayResults(tickets) {
    // Clear previous results
    ticketsContainer.innerHTML = '';
    
    // Display each ticket option
    tickets.forEach((ticket, index) => {
      const ticketElement = document.createElement('div');
      ticketElement.className = 'ticket-option';
      
      // Add best-price class to the lowest priced option (if it has a numeric price)
      if (currentSortOption === 'price' && index === 0 && typeof ticket.price === 'number') {
        ticketElement.classList.add('best-price');
      }
      
      // Create link to ticket provider
      const link = document.createElement('a');
      link.href = ticket.url;
      link.target = '_blank';
      
      // Format price display
      let priceDisplay = '';
      if (typeof ticket.price === 'number') {
        priceDisplay = `$${ticket.price.toFixed(2)}`;
      } else {
        priceDisplay = ticket.price; // Display text like "Check site"
      }
      
      // Add event name if available (from Ticketmaster API)
      const eventName = ticket.name ? `<div class="event-name">${ticket.name}</div>` : '';
      
      // Build ticket information HTML
      link.innerHTML = `
        <div>
          <span class="platform">${ticket.platform}</span>
          <span class="price">${priceDisplay}</span>
        </div>
        ${eventName}
        <div class="location">${ticket.venue}</div>
        <div class="date">${ticket.date}</div>
      `;
      
      // Add click event to open link in new tab
      link.addEventListener('click', function(e) {
        e.preventDefault();
        chrome.tabs.create({ url: ticket.url });
      });
      
      // Create track button for this concert
      const trackButton = document.createElement('button');
      
      // Check if this event is already being tracked
      const isTracked = trackedEvents.some(event => {
        return event.name === ticket.name && 
               event.venue === ticket.venue && 
               event.rawDate === ticket.rawDate;
      });
      
      trackButton.className = 'track-button';
      trackButton.textContent = isTracked ? 'Untrack' : 'Track Prices';
      trackButton.dataset.tracked = isTracked;
      
      // Add click event for tracking
      trackButton.addEventListener('click', function() {
        const isCurrentlyTracked = trackButton.dataset.tracked === 'true';
        
        if (isCurrentlyTracked) {
          // Remove from tracked events
          removeTrackedEvent(ticket);
          trackButton.textContent = 'Track Prices';
          trackButton.dataset.tracked = 'false';
        } else {
          // Add to tracked events
          addTrackedEvent(ticket);
          trackButton.textContent = 'Untrack';
          trackButton.dataset.tracked = 'true';
        }
      });
      
      ticketElement.appendChild(link);
      ticketElement.appendChild(trackButton);
      ticketsContainer.appendChild(ticketElement);
    });
  }
  
  /**
   * Formats a date string into a user-friendly format
   * @param {string} dateString - Date string in any valid format
   * @returns {string} - Formatted date string
   */
  function formatDate(dateString) {
    if (!dateString) return 'Date not specified';
    
    try {
      // Check if the date string is already formatted
      if (typeof dateString === 'string' && dateString.includes(' at ')) {
        return dateString;
      }
      
      const date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString; // Return original string if parsing failed
      }
      
      const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString; // Return original string on error
    }
  }
  
  // Helper function to make dates more compact
  function formatCompactDate(dateString) {
    if (!dateString) return '';
    
    // If it's already a compact date, return it
    if (typeof dateString === 'string' && dateString.length < 12) {
      return dateString;
    }
    
    try {
      // If it contains "at", it's a full date+time format
      if (typeof dateString === 'string' && dateString.includes(' at ')) {
        const parts = dateString.split(' at ');
        // Just extract the date part and abbreviate it
        const datePart = parts[0].replace(/(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s/, '');
        return datePart;
      }
      
      // Try to parse and format the date in a compact way
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      return dateString;
    } catch (error) {
      console.error('Error formatting compact date:', error);
      return dateString;
    }
  }
  
  // Functions for tracking concerts
  function loadTrackedEvents() {
    chrome.storage.local.get('trackedConcerts', function(result) {
      if (result.trackedConcerts) {
        trackedEvents = result.trackedConcerts;
        
        // Update tracked events tab
        updateTrackedEventsTab();
      }
    });
  }
  
  function addTrackedEvent(ticket) {
    // Create a new tracked event with price history
    const trackedEvent = {
      id: generateEventId(ticket), // Generate a unique ID
      name: ticket.name || ticket.platform,
      venue: ticket.venue,
      platform: ticket.platform,
      rawDate: ticket.rawDate,
      formattedDate: ticket.date,
      url: ticket.url,
      priceHistory: [
        {
          date: new Date().toISOString(),
          price: typeof ticket.price === 'number' ? ticket.price : null
        }
      ],
      lastChecked: new Date().toISOString()
    };
    
    // Add to tracked events
    trackedEvents.push(trackedEvent);
    
    // Save to storage
    saveTrackedEvents();
    
    // Update tracked events tab
    updateTrackedEventsTab();
    
    // Show confirmation
    showNotification('Concert added to tracking!');
  }
  
  function removeTrackedEvent(ticket) {
    const eventId = generateEventId(ticket);
    
    // Remove from array
    trackedEvents = trackedEvents.filter(event => generateEventId(event) !== eventId);
    
    // Save to storage
    saveTrackedEvents();
    
    // Update tracked events tab
    updateTrackedEventsTab();
    
    // Show confirmation
    showNotification('Concert removed from tracking');
  }
  
  function generateEventId(ticket) {
    // Create a unique ID based on event properties
    const name = ticket.name || ticket.platform || '';
    const venue = ticket.venue || '';
    const date = ticket.rawDate || '';
    
    return `${name}-${venue}-${date}`.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }
  
  function saveTrackedEvents() {
    chrome.storage.local.set({ 'trackedConcerts': trackedEvents });
  }
  
  function updateTrackedEventsTab() {
    const trackedContainer = document.getElementById('tracked-events-container');
    
    if (!trackedContainer) return;
    
    // Clear existing content
    trackedContainer.innerHTML = '';
    
    if (trackedEvents.length === 0) {
      trackedContainer.innerHTML = '<p class="no-tracked">No concerts are currently being tracked. Search for concerts and click "Track Prices" to monitor them.</p>';
      return;
    }
    
    // Create a table for tracked events
    const table = document.createElement('table');
    table.className = 'tracked-table';
    
    // Add table header
    table.innerHTML = `
      <thead>
        <tr>
          <th>Event</th>
          <th>Venue</th>
          <th>Date</th>
          <th>Current Price</th>
          <th>Price Change</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    // Add rows for each tracked event
    trackedEvents.forEach(event => {
      const row = document.createElement('tr');
      
      // Get current and previous prices
      const latestPrice = event.priceHistory.length > 0 ? 
        event.priceHistory[event.priceHistory.length - 1].price : null;
      
      let previousPrice = null;
      let priceChange = '';
      
      if (event.priceHistory.length > 1) {
        previousPrice = event.priceHistory[event.priceHistory.length - 2].price;
        
        if (latestPrice !== null && previousPrice !== null) {
          const change = latestPrice - previousPrice;
          const changePercent = (change / previousPrice * 100).toFixed(1);
          
          // Format price change with color
          if (change > 0) {
            priceChange = `<span class="price-up">↑ $${change.toFixed(2)} (${changePercent}%)</span>`;
          } else if (change < 0) {
            priceChange = `<span class="price-down">↓ $${Math.abs(change).toFixed(2)} (${Math.abs(changePercent)}%)</span>`;
          } else {
            priceChange = '<span class="price-same">No change</span>';
          }
        }
      }
      
      // Format current price
      let currentPrice = latestPrice !== null ? `$${latestPrice.toFixed(2)}` : 'Check site';
      
      // Ensure event name doesn't overflow
      const eventName = event.name && event.name.length > 16 ? 
        `${event.name.substring(0, 16)}...` : event.name;
        
      // Ensure venue doesn't overflow
      const venueDisplay = event.venue && event.venue.length > 16 ? 
        `${event.venue.substring(0, 16)}...` : event.venue;
      
      // Build row HTML with horizontally arranged buttons
      row.innerHTML = `
        <td title="${event.name}">${eventName}</td>
        <td title="${event.venue}">${venueDisplay}</td>
        <td>${formatCompactDate(event.formattedDate)}</td>
        <td>${currentPrice}</td>
        <td>${priceChange}</td>
        <td>
          <div class="action-buttons-container">
            <button class="action-btn view-btn" data-id="${event.id}">History</button>
            <button class="action-btn check-btn" data-id="${event.id}">Check</button>
            <button class="action-btn untrack-btn" data-id="${event.id}">Untrack</button>
          </div>
        </td>
      `;
      
      tbody.appendChild(row);
    });
    
    trackedContainer.appendChild(table);
    
    // Add event listeners to buttons
    trackedContainer.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const eventId = this.dataset.id;
        showPriceHistory(eventId);
      });
    });
    
    trackedContainer.querySelectorAll('.check-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const eventId = this.dataset.id;
        checkPriceNow(eventId);
      });
    });
    
    trackedContainer.querySelectorAll('.untrack-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const eventId = this.dataset.id;
        const event = trackedEvents.find(e => generateEventId(e) === eventId);
        if (event) {
          if (confirm(`Are you sure you want to stop tracking ${event.name}?`)) {
            removeTrackedEvent(event);
          }
        }
      });
    });
  }
  
  function showPriceHistory(eventId) {
    const event = trackedEvents.find(e => generateEventId(e) === eventId);
    
    if (!event) return;
    
    // Create modal for price history
    const modal = document.createElement('div');
    modal.className = 'price-history-modal';
    
    // Build chart data
    const priceData = event.priceHistory
      .filter(entry => entry.price !== null)
      .map(entry => ({
        date: new Date(entry.date).toLocaleDateString(),
        price: entry.price
      }));
    
    // Create modal content
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Price History: ${event.name}</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <h4>${event.venue} - ${event.formattedDate}</h4>
          <div class="price-chart" id="price-chart-${eventId}">
            ${priceData.length < 2 ? 'Not enough price data to show a chart yet.' : 'Price chart will be displayed here.'}
          </div>
          <table class="history-table">
            <thead>
              <tr>
                <th>Date Checked</th>
                <th>Price</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              ${event.priceHistory.map((entry, index) => {
                let change = '';
                if (index > 0 && entry.price !== null && event.priceHistory[index-1].price !== null) {
                  const priceDiff = entry.price - event.priceHistory[index-1].price;
                  change = priceDiff === 0 ? 'No change' : 
                          priceDiff > 0 ? `<span class="price-up">+$${priceDiff.toFixed(2)}</span>` : 
                          `<span class="price-down">-$${Math.abs(priceDiff).toFixed(2)}</span>`;
                }
                
                return `
                  <tr>
                    <td>${new Date(entry.date).toLocaleString()}</td>
                    <td>${entry.price !== null ? `$${entry.price.toFixed(2)}` : 'N/A'}</td>
                    <td>${change}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // Add to body
    document.body.appendChild(modal);
    
    // Add event listener to close button
    modal.querySelector('.close-modal').addEventListener('click', function() {
      document.body.removeChild(modal);
    });
    
    // Close when clicking outside
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
    
    // If we wanted to add a chart, we could use a library like Chart.js
    // For simplicity, we're just showing the table view
  }
  
  function checkPriceNow(eventId) {
    const event = trackedEvents.find(e => generateEventId(e) === eventId);
    
    if (!event) return;
    
    // Show loading indicator
    const btn = document.querySelector(`.check-btn[data-id="${eventId}"]`);
    const originalText = btn.textContent;
    btn.textContent = 'Checking...';
    btn.disabled = true;
    
    // Send request to check price
    chrome.runtime.sendMessage({
      action: 'searchTickets',
      data: {
        artist: event.name,
        date: event.rawDate,
        location: event.venue
      }
    }, function(response) {
      // Reset button
      btn.textContent = originalText;
      btn.disabled = false;
      
      if (response && response.success && response.tickets && response.tickets.length > 0) {
        // Find matching ticket
        const matchingTicket = response.tickets.find(ticket => {
          return ticket.platform === event.platform &&
                 (ticket.name === event.name || (!ticket.name && !event.name)) &&
                 ticket.venue === event.venue;
        });
        
        if (matchingTicket) {
          // Add new price to history
          event.priceHistory.push({
            date: new Date().toISOString(),
            price: typeof matchingTicket.price === 'number' ? matchingTicket.price : null
          });
          
          event.lastChecked = new Date().toISOString();
          
          // Save updates
          saveTrackedEvents();
          
          // Update display
          updateTrackedEventsTab();
          
          // Show success message
          showNotification('Price updated!');
        } else {
          showNotification('Could not find matching ticket');
        }
      } else {
        showNotification('Error checking prices');
      }
    });
  }
  
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 3000);
  }
  
  // Initialize tabs
  initTabs();
  
  function initTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        
        // Hide all tab contents
        tabContents.forEach(content => content.classList.add('hidden'));
        
        // Add active class to current tab
        this.classList.add('active');
        
        // Show current tab content
        const tabId = this.dataset.tab;
        document.getElementById(tabId).classList.remove('hidden');
        
        // If this is the tracked tab, update the display
        if (tabId === 'tracked-tab') {
          updateTrackedEventsTab();
        }
      });
    });
  }
})