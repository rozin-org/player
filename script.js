const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistEl = document.getElementById('playlist');
let songs = [];
let currentIndex = 0;

// IndexedDB setup
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PlayItNowDB', 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      db.createObjectStore('songs', { keyPath: 'name' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSongsToDB(files) {
  const db = await openDB();
  const tx = db.transaction('songs', 'readwrite');
  const store = tx.objectStore('songs');

  for (const file of files) {
    await store.put({ name: file.name, blob: file });
  }

  await tx.complete;
  localStorage.setItem('playlistOrder', JSON.stringify(files.map(f => f.name)));
}

async function loadSongsFromDB() {
  const db = await openDB();
  const tx = db.transaction('songs', 'readonly');
  const store = tx.objectStore('songs');

  const order = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  const songs = [];

  for (const name of order) {
    const request = store.get(name);
    const result = await new Promise((res, rej) => {
      request.onsuccess = () => res(request.result);
      request.onerror = () => rej(request.error);
    });
    if (result) songs.push(result.blob);
  }

  return songs;
}

function playSongFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  audioPlayer.src = url;
  audioPlayer.load();
  audioPlayer.play().catch(err => {
    console.warn('Playback failed:', err);
  });
  highlightCurrent(currentIndex);
}

function renderPlaylist(names) {
  playlistEl.innerHTML = '';
  names.forEach((name, i) => {
    const li = document.createElement('li');
    li.textContent = name;
    li.addEventListener('click', () => {
      currentIndex = i;
      playSongFromBlob(songs[currentIndex]);
    });
    playlistEl.appendChild(li);
  });
}

function highlightCurrent(index) {
  const items = playlistEl.querySelectorAll('li');
  items.forEach((li, i) => {
    li.classList.toggle('active', i === index);
  });
}

// File selection
fileInput.addEventListener('change', async () => {
  const files = Array.from(fileInput.files).filter(file =>
    file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')
  );
  if (files.length === 0) return;

  await saveSongsToDB(files);
  songs = files.map(f => f);
  currentIndex = 0;
  playSongFromBlob(songs[currentIndex]);
  renderPlaylist(files.map(f => f.name));
});

// Restore playlist on load
window.addEventListener('load', async () => {
  const order = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  if (order.length > 0) {
    songs = await loadSongsFromDB();
    if (songs.length > 0) {
      currentIndex = 0;
      playSongFromBlob(songs[currentIndex]);
      renderPlaylist(order);
    }
  }
});
document.getElementById('clearBtn').addEventListener('click', async () => {
  const db = await openDB();
  const tx = db.transaction('songs', 'readwrite');
  const store = tx.objectStore('songs');

  // Clear all stored songs
  store.clear();

  // Clear playlist order metadata
  localStorage.removeItem('playlistOrder');

  // Reset UI
  songs = [];
  currentIndex = 0;
  audioPlayer.src = '';
  playlistEl.innerHTML = '';

  alert('Playlist cleared!');
});

audioPlayer.addEventListener('ended', () => {
  currentIndex++;
  if (currentIndex < songs.length) {
    playSongFromBlob(songs[currentIndex]);
  }
});

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker registered:', reg))
    .catch(err => console.error('Service Worker registration failed:', err));
}
