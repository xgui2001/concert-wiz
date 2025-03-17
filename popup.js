  document.addEventListener('DOMContentLoaded', function() {
  const searchForm = document.getElementById('search-form');
  const loadingElement = document.getElementById('loading');
  const resultsElement = document.getElementById('results');
  const errorElement = document.getElementById('error');
  const ticketsContainer = document.getElementById('tickets-container');
  
  searchForm.addEventListener('submit', function(event) {
    event.preventDefault();
    
    // Get form values
    const artist = document.getElementById('artist').value.trim();
    const date = document.getElementById('date').value;
    const location = document.getElementById('location').value.trim();
    
    // Show loading, hide results and error
    loadingElement.classList.remove('hidden');
    resultsElement.classList.add('hidden');
    errorElement.classList.add('hidden');
    
    // Send message to background script to start the search
    chrome.runtime.sendMessage({
      action: 'searchTickets',
      data: {
        artist,
        date,
        location
      }
    }, function(response) {
      // Hide loading
      loadingElement.classList.add('hidden');
      
      if (response && response.success && response.tickets && response.tickets.length > 0) {
        // Show results
        displayResults(response.tickets);
        resultsElement.classList.remove('hidden');
      } else {
        // Show error
        errorElement.classList.remove('hidden');
      }
    });
  });
  
  function displayResults(tickets) {
    // Clear previous results
    ticketsContainer.innerHTML = '';
    
    // Filter out tickets with numeric prices
    const ticketsWithPrices = tickets.filter(ticket => typeof ticket.price === 'number');
    // Get tickets without numeric prices
    const ticketsWithoutPrices = tickets.filter(ticket => typeof ticket.price !== 'number');
    
    // Sort tickets with prices by price (lowest first)
    ticketsWithPrices.sort((a, b) => a.price - b.price);
    
    // Combine sorted arrays: first tickets with prices, then tickets without prices
    const sortedTickets = [...ticketsWithPrices, ...ticketsWithoutPrices];
    
    // Display each ticket option
    sortedTickets.forEach((ticket, index) => {
      const ticketElement = document.createElement('div');
      ticketElement.className = 'ticket-option';
      
      // Add best-price class to the lowest priced option (if it has a numeric price)
      if (index === 0 && typeof ticket.price === 'number') {
        ticketElement.classList.add('best-price');
      }
      
      // Create link to ticket provider
      const link = document.createElement('a');
      link.href = ticket.url;
      link.target = '_blank';
      
      // Format price display
      let priceDisplay = '';
      if (typeof ticket.price === 'number') {
        priceDisplay = `from ${ticket.price.toFixed(2)}`;
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
        <div class="date">${formatDate(ticket.date)}</div>
      `;
      
      // Add click event to open link in new tab
      link.addEventListener('click', function(e) {
        e.preventDefault();
        chrome.tabs.create({ url: ticket.url });
      });
      
      ticketElement.appendChild(link);
      ticketsContainer.appendChild(ticketElement);
    });
  }
  
  function formatDate(dateString) {
    if (!dateString) return 'Date not specified';
    
    const date = new Date(dateString);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
});