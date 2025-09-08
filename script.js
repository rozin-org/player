const fileInput = document.getElementById('fileInput');
const audioPlayer = document.getElementById('audioPlayer');
const playlistEl = document.getElementById('playlist');
let songs = [];
let currentIndex = 0;

fileInput.addEventListener('change', () => {
  songs = Array.from(fileInput.files).filter(file => file.type === 'audio/mp3');
  if (songs.length === 0) {
    alert('No MP3 files selected.');
    return;
  }
  currentIndex = 0;
  playSong(currentIndex);
  renderPlaylist();
});

function playSong(index) {
  const file = songs[index];
  const url = URL.createObjectURL(file);
  audioPlayer.src = url;
  audioPlayer.play();
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
