const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistEl = document.getElementById('playlist');
let songs = [];
let currentIndex = 0;

// Restore playlist metadata on load
window.addEventListener('load', () => {
  const savedNames = JSON.parse(localStorage.getItem('playlistNames') || '[]');
  if (savedNames.length > 0) {
    alert('Welcome back! Please reselect your MP3 files to restore your playlist.');
  }
});

// Handle file selection
fileInput.addEventListener('change', () => {
  const savedNames = JSON.parse(localStorage.getItem('playlistNames') || '[]');
  console.log(fileInput.files);
  Array.from(fileInput.files).forEach(file => {
    console.log(file.name, file.type);
    songs.push(file);
  });
  //songs = Array.from(fileInput.files).filter(file =>
  //  file.type.startsWith('audio/') || file.name.toLowerCase().endsWith('.mp3')
  //);

  // Match reselected files to saved playlist
  if (savedNames.length > 0) {
    songs = songs.filter(file => savedNames.includes(file.name));
  }

  if (songs.length === 0) {
    alert('No valid songs files selected.');
    return;
  }

  // Save playlist metadata
  const fileNames = songs.map(file => file.name);
  localStorage.setItem('playlistNames', JSON.stringify(fileNames));

  currentIndex = 0;
  playSong(currentIndex);
  renderPlaylist();
});

function playSong(index) {
  const file = songs[index];
  if (!file) return;

  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.load();
  audioPlayer.play().catch(err => {
    console.warn('Playback blocked or failed:', err);
    alert('Tap the play button to start the song manually.');
  });

  highlightCurrent(index);
}

function renderPlaylist() {
  playlistEl.innerHTML = '';
  songs.forEach((song, i) => {
    const li = document.createElement('li');
    li.textContent = song.name;
    li.addEventListener('click', () => {
      currentIndex = i;
      playSong(currentIndex);
    });
    playlistEl.appendChild(li);
  });
  highlightCurrent(currentIndex);
}

function highlightCurrent(index) {
  const items = playlistEl.querySelectorAll('li');
  items.forEach((li, i) => {
    li.classList.toggle('active', i === index);
  });
}

audioPlayer.addEventListener('ended', () => {
  currentIndex++;
  if (currentIndex < songs.length) {
    playSong(currentIndex);
  }
});

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker registered:', reg))
    .catch(err => console.error('Service Worker registration failed:', err));
}
