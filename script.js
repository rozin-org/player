const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistEl = document.getElementById('playlist');
let songs = [];
let playedIndices = []; // Track played songs in shuffle mode
let currentIndex = 0;
let isShuffle = false;

// ===========================================================
// ✅ Dexie setup
const db = new Dexie('PlayItNowDB');
db.version(1).stores({
  songs: 'name'
});
// ===========================================================
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
// ===========================================================
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
// ===========================================================
// ✅ Play next song
function playNextSong() {
  if (isShuffle) {
    // If all songs have been played, reset
    if (playedIndices.length >= songs.length) {
      playedIndices = [];
    }
    // Get unplayed indices
    const unplayed = [...Array(songs.length).keys()].filter(i => !playedIndices.includes(i));
    // Pick a random unplayed index
    currentIndex = unplayed[Math.floor(Math.random() * unplayed.length)];
    playedIndices.push(currentIndex);
  } 
  else {
    currentIndex++;
  }

  if (currentIndex >= songs.length) {
    currentIndex = 0;
  }
  playSongFromBlob(songs[currentIndex]);
  saveStateToDB();
}
// ===========================================================
// ✅ Play song from Blob
function playSongFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  audioPlayer.src = url;
  audioPlayer.load();
  audioPlayer.play().catch(err => {
    console.warn('Playback failed:', err);
  });
  highlightCurrent(currentIndex); // Highlight the currently playing song
}
// ===========================================================
// ✅ Render playlist
function renderPlaylist(order) {
  playlistEl.innerHTML = '';

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  order.forEach((name, i) => {
    const row = document.createElement('tr');
    //if (i === currentIndex) row.classList.add('active');

    // Song name cell
    const nameCell = document.createElement('td');
    nameCell.textContent = name;
    nameCell.style.padding = '10px';
    nameCell.style.cursor = 'pointer';
    nameCell.addEventListener('click', () => {
      currentIndex = i;
      playSongFromBlob(songs[currentIndex]);
      saveStateToDB();
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
// ===========================================================
// ✅ Highlight current song
function highlightCurrent(index) {
  const rows = playlistEl.querySelectorAll('tr');
  rows.forEach((row, i) => {
    row.classList.toggle('active', i === index); // Mark the playing song
  });
  document.getElementById("now_playing").innerHTML = songs[index].name;
  // Update Media Session metadata
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: songs[currentIndex].name,
      artist: '', // You can add artist if available
      album: '',  // You can add album if available
      artwork: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    });
  }
}
// ===========================================================
// ✅ Save currentIndex and shuffle state to localStorage
function saveStateToDB() {
  localStorage.setItem('currentIndex', currentIndex);
  localStorage.setItem('isShuffle', isShuffle);
}

// ===========================================================
// ✅ Load currentIndex and shuffle state from localStorage
function loadStateFromDB() {
  currentIndex = parseInt(localStorage.getItem('currentIndex') || '0', 10);
  isShuffle = localStorage.getItem('isShuffle') === 'true';
  if (isShuffle) {
    document.getElementById('shuffleBtn').innerHTML = '🔀 Shuffle On';
  } else {
    document.getElementById('shuffleBtn').innerHTML = '🔀 Shuffle Off';
  }
}
// ===========================================================
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
  if (currentIndex >= songs.length) {
    currentIndex = 0;
  }
  if (songs.length > 0) {
    renderPlaylist(names);
    playSongFromBlob(songs[currentIndex]);
  }
  fileInput.value = ''; // clears the visible file name
  saveStateToDB();
});
// ===========================================================
// ✅ Restore playlist on load
window.addEventListener('load', async () => {
  updateVersionTag();
  loadStateFromDB();
  const { blobs, names } = await loadSongsFromDB();
  if (blobs.length > 0) {
    songs = blobs;
    if (currentIndex >= songs.length) {
      currentIndex = 0;
      saveStateToDB();

    }
    renderPlaylist(names);
    playSongFromBlob(songs[currentIndex]);
  }
});

// ===========================================================
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
// ===========================================================
// ✅ Remove single song
async function removeSong(name) {
  await db.songs.delete(name);

  const order = JSON.parse(localStorage.getItem('playlistOrder') || '[]');
  const newOrder = order.filter(n => n !== name);
  localStorage.setItem('playlistOrder', JSON.stringify(newOrder));

  const { blobs } = await loadSongsFromDB();
  songs = blobs;

  renderPlaylist(newOrder);
  if (currentIndex >= songs.length) {
    currentIndex = 0;
  }
  playSongFromBlob(songs[currentIndex]);
  saveStateToDB();

}

// ===========================================================
// ✅ Toggle shuffle mode
document.getElementById('shuffleBtn').addEventListener('click', async () => {
  isShuffle = !isShuffle;
  if (isShuffle) {
    document.getElementById('shuffleBtn').innerHTML = '🔀 Shuffle On';
  } else {
    document.getElementById('shuffleBtn').innerHTML = '🔀 Shuffle Off';
  }
  saveStateToDB();
});
// ===========================================================
document.getElementById('nextBtn').addEventListener('click', () => {
  playNextSong();
});
// ===========================================================
// ✅ Auto-play next song
audioPlayer.addEventListener('ended', () => {
  playNextSong();
});

// ===========================================================
async function updateVersionTag(){
  try{
      const response = await fetch('https://rozin-org.github.io/player/version.json', { cache: 'no-store' });
      const data = await response.json();
      const version = data.version || 'unknown';
      document.getElementById('versionDisplay').textContent = `v${version}`;
      document.title = `Play it Now v${version}`;
  }
  catch (err) {
    console.warn('Failed to load version:', err);
    document.getElementById('versionDisplay').textContent = 'v?';
  }
}
// ===========================================================
function isNewerVersion(latest, current) {
  const l = latest.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < l.length; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}
// ===========================================================
// ✅ Service worker update prompt
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js',{updateViaCache: 'none'}).then(reg => {
    reg.onupdatefound = () => {
      const newWorker = reg.installing;
      newWorker.onstatechange = () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          //const confirmed = confirm('New version available! Reload to update?');
          //if (confirmed) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          //}
        }
      };
    };
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });

  navigator.serviceWorker.getRegistration().then(reg => {
    reg.update(); // manually check for a new SW
  });
}