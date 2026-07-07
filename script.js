// ----- Load contacts from browser storage -----
let contacts = JSON.parse(localStorage.getItem('contacts')) || [];

function renderContacts() {
  const list = document.getElementById('contacts-list');
  list.innerHTML = '';

  contacts.forEach((contact, index) => {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.innerHTML = `
      <span>${contact.name} (${contact.number})</span>
      <button onclick="deleteContact(${index})">✕</button>
    `;
    list.appendChild(div);
  });
}

function addContact() {
  const nameInput = document.getElementById('contact-name');
  const numberInput = document.getElementById('contact-number');

  const name = nameInput.value.trim();
  const number = numberInput.value.trim();

  if (!name || !number) {
    alert('Please enter both a name and a WhatsApp number.');
    return;
  }

  contacts.push({ name, number });
  localStorage.setItem('contacts', JSON.stringify(contacts));

  nameInput.value = '';
  numberInput.value = '';
  renderContacts();
}

function deleteContact(index) {
  contacts.splice(index, 1);
  localStorage.setItem('contacts', JSON.stringify(contacts));
  renderContacts();
}

// ----- SOS button logic -----
async function triggerSOS() {
  const statusText = document.getElementById('status-text');

  if (contacts.length === 0) {
    alert('Please add at least one emergency contact first.');
    return;
  }

  if (!navigator.geolocation) {
    alert('Location services are not supported on this device.');
    return;
  }

  statusText.textContent = 'Getting your location...';

  navigator.geolocation.getCurrentPosition(async (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

    // Try to get battery status (not supported on all browsers)
    let batteryText = '';
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      const percent = Math.round(battery.level * 100);
      batteryText = ` My phone battery is at ${percent}%.`;
    }

    const message = `🚨 I need help. This is my current live location: ${mapsLink}.${batteryText} Please reach out to me immediately.`;

    // Open a WhatsApp message for each contact
    contacts.forEach((contact) => {
      const cleanNumber = contact.number.replace(/\D/g, ''); // strips spaces, dashes etc
      const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
      window.open(waLink, '_blank');
    });

    statusText.textContent = 'Alert sent to your emergency contacts.';
  }, () => {
    statusText.textContent = 'Could not get your location. Please enable location access.';
  });
}

// ----- Run on page load -----
renderContacts();