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
// ----- Emergency Recording -----
let mediaRecorder;
let recordedChunks = [];
let cameraStream;
let isRecording = false;

const videoPreview = document.getElementById('camera-preview');
const recordBtn = document.getElementById('record-btn');
const recordingStatus = document.getElementById('recording-status');
const recordingsList = document.getElementById('recordings-list');

async function toggleRecording() {
  if (!isRecording) {
    await startRecording();
  } else {
    stopRecording();
  }
}

async function startRecording() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    videoPreview.srcObject = cameraStream;
    recordedChunks = [];

    mediaRecorder = new MediaRecorder(cameraStream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = saveRecording;

    mediaRecorder.start();
    isRecording = true;

    recordBtn.textContent = '⏹️ Stop Recording';
    recordBtn.classList.add('recording');
    recordingStatus.textContent = 'Recording... this clip will be saved to your profile.';

  } catch (err) {
    recordingStatus.textContent = 'Could not access camera/microphone. Please allow permissions.';
  }
}

function stopRecording() {
  mediaRecorder.stop();
  cameraStream.getTracks().forEach(track => track.stop());
  videoPreview.srcObject = null;

  isRecording = false;
  recordBtn.textContent = '🎥 Start Recording';
  recordBtn.classList.remove('recording');
  recordingStatus.textContent = 'Recording saved below.';
}

function saveRecording() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toLocaleString();

  const item = document.createElement('div');
  item.className = 'recording-item';
  item.innerHTML = `
    <p>Recorded: ${timestamp}</p>
    <video src="${url}" controls></video>
    <a href="${url}" download="safeshare-recording-${Date.now()}.webm">⬇️ Download / Share</a>
  `;

  recordingsList.prepend(item);
}
// ----- Unsafe Areas Map -----
let map;
let pendingLatLng = null;
let reports = JSON.parse(localStorage.getItem('unsafeReports')) || [];

const categoryColors = {
  lighting: '#c98a3e',
  harassment: '#d63b3b',
  isolated: '#7a2e4e',
  other: '#756e68'
};

const categoryLabels = {
  lighting: 'Poor lighting',
  harassment: 'Harassment reported',
  isolated: 'Isolated / empty area',
  other: 'Other concern'
};

function initMap() {
  // Centered on Chennai by default; will re-center if user allows location
  map = L.map('unsafe-map').setView([12.9716, 80.2200], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  // Try to center on the user's actual location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      map.setView([position.coords.latitude, position.coords.longitude], 14);
    });
  }

  // Load any previously saved reports
  reports.forEach(addMarkerToMap);

  // Tap-to-report
  map.on('click', (e) => {
    pendingLatLng = e.latlng;
    document.getElementById('report-form').classList.remove('hidden');
  });
}

function addMarkerToMap(report) {
  const marker = L.circleMarker([report.lat, report.lng], {
    radius: 9,
    fillColor: categoryColors[report.category],
    color: '#fff',
    weight: 2,
    fillOpacity: 0.9
  }).addTo(map);

  const noteText = report.note ? `<br>"${report.note}"` : '';
  marker.bindPopup(`<strong>${categoryLabels[report.category]}</strong>${noteText}`);
}

function saveReport() {
  const category = document.getElementById('report-category').value;
  const note = document.getElementById('report-note').value.trim();

  if (!pendingLatLng) return;

  const report = {
    lat: pendingLatLng.lat,
    lng: pendingLatLng.lng,
    category,
    note
  };

  reports.push(report);
  localStorage.setItem('unsafeReports', JSON.stringify(reports));
  addMarkerToMap(report);

  cancelReport();
}

function cancelReport() {
  pendingLatLng = null;
  document.getElementById('report-form').classList.add('hidden');
  document.getElementById('report-note').value = '';
}

// Initialize the map once the page loads
initMap();