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
  }

  function renderPlaylist() {
    playlistEl.innerHTML = '';
    songs.forEach((song, i) => {
      const li = document.createElement('li');
      li.textContent = song.name;
      if (i === currentIndex) li.style.fontWeight = 'bold';
      playlistEl.appendChild(li);
    });
  }

  audioPlayer.addEventListener('ended', () => {
    currentIndex++;
    if (currentIndex < songs.length) {
      playSong(currentIndex);
      renderPlaylist();
    }
  });
