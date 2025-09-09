const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistEl = document.getElementById('playlist');
let songs = [];
let currentIndex = 0;
const CACHE_NAME = 'play-it-now-v1.0.7'; // bump version

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
  highlightCurrent(currentIndex);
}

function renderPlaylist(order) {
  playlistEl.innerHTML = '';
  order.forEach((name, i) => {
    const li = document.createElement('li');
    if (i === currentIndex) li.classList.add('active');

    // Create a span for the song name
    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;

    // Create the delete button
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.style.marginLeft = '10px';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeSong(name);
    });

    // Add click to the whole list item
    li.addEventListener('click', () => {
      currentIndex = i;
      playSongFromBlob(songs[currentIndex]);
    });

    // Append name and button side by side
    li.appendChild(nameSpan);
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

// ✅ Auto-play next song
audioPlayer.addEventListener('ended', () => {
  currentIndex++;
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