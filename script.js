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
async function saveSongsToDB(newFiles) {
  const db = await openDB();
  const tx = db.transaction('songs', 'readwrite');
  const store = tx.objectStore('songs');

  // Get existing playlist order
  const existingOrder = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  const updatedOrder = [...existingOrder];

  for (const file of newFiles) {
    const alreadyExists = existingOrder.includes(file.name);
    if (!alreadyExists) {
      await store.put({ name: file.name, blob: file });
      updatedOrder.push(file.name);
    }
  }

  await tx.complete;
  localStorage.setItem('playlistOrder', JSON.stringify(updatedOrder));
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

    // Highlight current song
    if (i === currentIndex) li.classList.add('active');

    // Play on click
    li.addEventListener('click', () => {
      currentIndex = i;
      playSongFromBlob(songs[currentIndex]);
    });

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.style.marginLeft = '10px';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Prevent triggering play
      await removeSong(name);
    });

    li.appendChild(delBtn);
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
  const newFiles = Array.from(fileInput.files).filter(file =>
    file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')
  );
  if (newFiles.length === 0) return;

  await saveSongsToDB(newFiles);
  songs = await loadSongsFromDB();
  currentIndex = 0;
  playSongFromBlob(songs[currentIndex]);

  const updatedOrder = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  renderPlaylist(updatedOrder);
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

async function removeSong(name) {
  const db = await openDB();
  const tx = db.transaction('songs', 'readwrite');
  const store = tx.objectStore('songs');
  await store.delete(name);
  await tx.complete;

  // Update localStorage
  const order = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  const newOrder = order.filter(n => n !== name);
  localStorage.setItem('playlistOrder', JSON.stringify(newOrder));

  // Update songs array
  songs = songs.filter((blob, i) => order[i] !== name);
  currentIndex = 0;

  renderPlaylist(newOrder);
  audioPlayer.src = '';
}


// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker registered:', reg))
    .catch(err => console.error('Service Worker registration failed:', err));
}
