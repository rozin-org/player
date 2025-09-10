const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistEl = document.getElementById('playlist');
let songs = [];
let currentIndex = 0;
const CACHE_NAME = 'play-it-now-v1.0.9'; // bump version

// ✅ Dexie setup
const db = new Dexie('PlayItNowDB');
db.version(1).stores({
  songs: 'name'
});

// ✅ Save songs to Dexie
async function saveSongsToDB(newFiles) {
  const existingOrder = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  const updatedOrder = [...existingOrder];

  for (const file of newFiles) {
    if (!existingOrder.includes(file.name)) {
      await db.songs.put({ name: file.name, blob: file });
      updatedOrder.push(file.name);
    }
  }

  localStorage.setItem('playlistOrder', JSON.stringify(updatedOrder));
}

// ✅ Load songs from Dexie
async function loadSongsFromDB() {
  const order = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  const blobs = [];
  const names = [];

  for (const name of order) {
    const entry = await db.songs.get(name);
    if (entry && entry.blob) {
      blobs.push(entry.blob);
      names.push(name);
    }
  }

  return { blobs, names };
}

function playSongFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  audioPlayer.src = url;
  audioPlayer.load();
  audioPlayer.play().catch(err => {
    console.warn('Playback failed:', err);
  });
  highlightCurrent(currentIndex); // Highlight the currently playing song
}

function renderPlaylist(order) {
  playlistEl.innerHTML = '';

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  order.forEach((name, i) => {
    const row = document.createElement('tr');
    if (i === currentIndex) row.classList.add('active');

    // Song name cell
    const nameCell = document.createElement('td');
    nameCell.textContent = name;
    nameCell.style.padding = '10px';
    nameCell.style.cursor = 'pointer';
    nameCell.addEventListener('click', () => {
      currentIndex = i;
      playSongFromBlob(songs[currentIndex]);
      highlightCurrent(currentIndex); // Highlight the selected song
    });

    // Delete button cell
    const delCell = document.createElement('td');
    delCell.style.textAlign = 'right';
    delCell.style.padding = '10px';

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.style.marginLeft = '10px';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeSong(name);
    });

    delCell.appendChild(delBtn);
    row.appendChild(nameCell);
    row.appendChild(delCell);
    table.appendChild(row);
  });

  playlistEl.appendChild(table);
}

function highlightCurrent(index) {
  const rows = playlistEl.querySelectorAll('tr');
  rows.forEach((row, i) => {
    row.classList.toggle('active', i === index); // Mark the playing song
  });
}

// ✅ File selection
fileInput.addEventListener('change', async () => {
  const newFiles = Array.from(fileInput.files).filter(file =>
    file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')
  );
  if (newFiles.length === 0) return;

  await saveSongsToDB(newFiles);
  await new Promise(res => setTimeout(res, 150)); // iOS needs time to flush

  const { blobs, names } = await loadSongsFromDB();
  if (blobs.length === 0) {
    alert("iOS may not have committed the files. Try reselecting or refreshing.");
  }
  songs = blobs;
  currentIndex = 0;
  if (songs.length > 0) {
    playSongFromBlob(songs[currentIndex]);
    renderPlaylist(names);
  }
  fileInput.value = ''; // clears the visible file name
});

// ✅ Restore playlist on load
window.addEventListener('load', async () => {
  const { blobs, names } = await loadSongsFromDB();
  if (blobs.length > 0) {
    songs = blobs;
    currentIndex = 0;
    playSongFromBlob(songs[currentIndex]);
    renderPlaylist(names);
  }
});

// ✅ Clear playlist
document.getElementById('clearBtn').addEventListener('click', async () => {
  await db.songs.clear();
  localStorage.removeItem('playlistOrder');

  songs = [];
  currentIndex = 0;
  audioPlayer.src = '';
  playlistEl.innerHTML = '';

  alert('Playlist cleared!');
});

// ✅ Remove single song
async function removeSong(name) {
  await db.songs.delete(name);

  const order = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  const newOrder = order.filter(n => n !== name);
  localStorage.setItem('playlistOrder', JSON.stringify(newOrder));

  const { blobs } = await loadSongsFromDB();
  songs = blobs;
  currentIndex = 0;

  renderPlaylist(newOrder);
  audioPlayer.src = '';
}

// ✅ Shuffle songs
let isShuffle = false;

async function shuffleSongs() {
  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [songs[i], songs[j]] = [songs[j], songs[i]];
  }
  const { names } = await loadSongsFromDB(); // Keep original names
  renderPlaylist(names); // Display original names in shuffled order
}

// ✅ Toggle shuffle mode
document.getElementById('shuffleBtn').addEventListener('click', async () => {
  isShuffle = !isShuffle;
  if (isShuffle) {
    shuffleSongs();
    alert('Shuffle mode enabled!');
  } else {
    alert('Shuffle mode disabled!');
    const { names } = await loadSongsFromDB(); // Reload names from local DB
    renderPlaylist(names); // Display original names
  }
});

// ✅ Auto-play next song
audioPlayer.addEventListener('ended', () => {
  if (isShuffle) {
    currentIndex = Math.floor(Math.random() * songs.length);
  } else {
    currentIndex++;
  }

  if (currentIndex < songs.length) {
    playSongFromBlob(songs[currentIndex]);
  }
});

// ✅ Service worker update prompt
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.onupdatefound = () => {
      const newWorker = reg.installing;
      newWorker.onstatechange = () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          alert('New version available! Please reload.');
        }
      };
    };
  });
}