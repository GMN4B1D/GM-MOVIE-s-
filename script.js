
<script>
"use strict";

const $ = id => document.getElementById(id);

const MOVIE_KEY = "gmflix_movies_v3";
const BANNER_KEY = "gmflix_banner_v3";

const defaultBanner = {
  image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1600&q=80",
  title: "Unlimited Entertainment.",
  desc: "Discover movies and series on GMFLIX."
};

const samples = [
  {
    id: "sample1",
    title: "Big Buck Bunny",
    type: "Movie",
    year: "2008",
    poster: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217",
    source: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    description: "Sample video to test the player."
  },
  {
    id: "sample2",
    title: "Elephant Dream",
    type: "Movie",
    year: "2006",
    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Elephants_Dream_s5_both.jpg/640px-Elephants_Dream_s5_both.jpg",
    source: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    description: "Sample video to test the player."
  }
];

function readData(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

let movies = readData(MOVIE_KEY, samples);
if (!Array.isArray(movies)) movies = samples.slice();

let banner = {
  ...defaultBanner,
  ...readData(BANNER_KEY, {})
};

let activeFilter = "All";
let controlsTimer = null;

function notify(message) {
  const toast = $("toast");
  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.style.display = "block";

  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    toast.style.display = "none";
  }, 3000);
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    notify("Save failed. Browser storage may be full.");
    return false;
  }
}

/* HOMEPAGE BANNER */

function applyBanner() {
  const image = (banner.image || defaultBanner.image)
    .replace(/["\\]/g, "");

  $("hero").style.backgroundImage =
    `linear-gradient(90deg,#090909 0%,#090909d9 45%,transparent),
     linear-gradient(0deg,#090909,transparent),
     url("${image}")`;

  $("heroTitle").textContent =
    banner.title || defaultBanner.title;

  $("heroDesc").textContent = banner.desc || "";

  $("bannerImg").value = banner.image || "";
  $("bannerText").value = banner.title || "";
  $("bannerDesc").value = banner.desc || "";
}

$("saveBanner").addEventListener("click", () => {
  const image = $("bannerImg").value.trim();

  if (image && !/^https?:\/\//i.test(image)) {
    notify("Enter a valid banner image URL.");
    return;
  }

  const updatedBanner = {
    image: image || defaultBanner.image,
    title: $("bannerText").value.trim() || defaultBanner.title,
    desc: $("bannerDesc").value.trim()
  };

  if (saveData(BANNER_KEY, updatedBanner)) {
    banner = updatedBanner;
    applyBanner();
    notify("Banner saved in this browser.");
  }
});

/* MOVIE AND SERIES DISPLAY */

function renderMovies() {
  const query = $("search").value.trim().toLowerCase();

  const filtered = movies.filter(movie => {
    const matchesType =
      activeFilter === "All" ||
      movie.type === activeFilter;

    const text = [
      movie.title,
      movie.description,
      movie.year
    ].join(" ").toLowerCase();

    return matchesType && text.includes(query);
  });

  const grid = $("grid");
  grid.replaceChildren();

  $("empty").hidden = filtered.length > 0;

  filtered.forEach(movie => {
    const card = document.createElement("article");
    card.className = "card";
    card.tabIndex = 0;

    const poster = document.createElement("img");
    poster.className = "poster";
    poster.src = movie.poster;
    poster.alt = movie.title;
    poster.loading = "lazy";

    poster.onerror = () => {
      poster.removeAttribute("src");
      poster.alt = "Poster unavailable";
    };

    const info = document.createElement("div");
    info.className = "info";

    const title = document.createElement("h3");
    title.textContent = movie.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent =
      [movie.type, movie.year].filter(Boolean).join(" • ");

    info.append(title, meta);
    card.append(poster, info);

    card.addEventListener("click", () => playMovie(movie));

    card.addEventListener("keydown", event => {
      if (event.key === "Enter") playMovie(movie);
    });

    grid.append(card);
  });

  renderAdminList();
}

/* ADMIN: ADD, EDIT AND DELETE */

function renderAdminList() {
  const list = $("adminList");
  list.replaceChildren();

  if (!movies.length) {
    list.textContent = "No movies or series added yet.";
    return;
  }

  movies.forEach(movie => {
    const row = document.createElement("div");
    row.className = "adminItem";

    const img = document.createElement("img");
    img.src = movie.poster;
    img.alt = "";

    const name = document.createElement("div");
    name.className = "adminName";
    name.textContent = movie.title + " · " + movie.type;

    const editButton = document.createElement("button");
    editButton.className = "gray";
    editButton.textContent = "Edit";
    editButton.type = "button";
    editButton.addEventListener("click", () => editMovie(movie.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "red";
    deleteButton.textContent = "Delete";
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteMovie(movie.id));

    row.append(img, name, editButton, deleteButton);
    list.append(row);
  });
}

function resetMovieForm() {
  $("movieForm").reset();
  $("editId").value = "";
  $("formTitle").textContent = "Add Movie / Series";
  $("submitMovie").textContent = "Add Title";
  $("cancelEdit").hidden = true;
}

function editMovie(id) {
  const movie = movies.find(item => item.id === id);
  if (!movie) return;

  $("editId").value = movie.id;
  $("title").value = movie.title || "";
  $("type").value = movie.type || "Movie";
  $("year").value = movie.year || "";
  $("poster").value = movie.poster || "";
  $("source").value = movie.source || "";
  $("description").value = movie.description || "";

  $("formTitle").textContent = "Edit Movie / Series";
  $("submitMovie").textContent = "Save Changes";
  $("cancelEdit").hidden = false;

  $("movieForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function deleteMovie(id) {
  const movie = movies.find(item => item.id === id);
  if (!movie) return;

  if (!confirm('Delete "' + movie.title + '"?')) return;

  const oldMovies = movies.slice();
  movies = movies.filter(item => item.id !== id);

  if (saveData(MOVIE_KEY, movies)) {
    if ($("editId").value === id) resetMovieForm();
    renderMovies();
    notify("Title deleted.");
  } else {
    movies = oldMovies;
  }
}

$("movieForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = $("editId").value;

  const movie = {
    id: id || ("movie-" + Date.now()),
    title: $("title").value.trim(),
    type: $("type").value,
    year: $("year").value,
    poster: $("poster").value.trim(),
    source: $("source").value.trim(),
    description: $("description").value.trim()
  };

  if (!movie.title || !movie.poster || !movie.source) {
    notify("Fill in all required fields.");
    return;
  }

  const oldMovies = movies.slice();

  if (id) {
    const index = movies.findIndex(item => item.id === id);

    if (index === -1) {
      notify("Movie not found.");
      return;
    }

    movies[index] = movie;
  } else {
    movies.unshift(movie);
  }

  if (saveData(MOVIE_KEY, movies)) {
    resetMovieForm();
    renderMovies();
    notify(id ? "Movie updated." : "Movie added.");
  } else {
    movies = oldMovies;
  }
});

$("cancelEdit").addEventListener("click", resetMovieForm);

/* ADMIN PANEL OPEN/CLOSE */

$("adminOpen").addEventListener("click", () => {
  $("adminModal").classList.add("active");
  renderAdminList();
});

$("closeAdmin").addEventListener("click", () => {
  $("adminModal").classList.remove("active");
});

$("adminModal").addEventListener("click", event => {
  if (event.target === $("adminModal")) {
    $("adminModal").classList.remove("active");
  }
});

/* SEARCH AND FILTER */

$("search").addEventListener("input", renderMovies);

$("filters").addEventListener("click", event => {
  const button = event.target.closest("button[data-type]");
  if (!button) return;

  activeFilter = button.dataset.type;

  $("filters").querySelectorAll("button").forEach(item => {
    item.classList.toggle("active", item === button);
  });

  renderMovies();
});

/* VIDEO PLAYER */

function showPlayerControls() {
  const player = $("player");
  if (!player.classList.contains("active")) return;

  player.classList.remove("controls-hidden");
  clearTimeout(controlsTimer);

  if (!$("video").paused) {
    controlsTimer = setTimeout(() => {
      player.classList.add("controls-hidden");
    }, 3500);
  }
}

function playMovie(movie) {
  if (!movie || !movie.source) {
    notify("Video URL is missing.");
    return;
  }

  const video = $("video");

  clearTimeout(controlsTimer);
  $("playingTitle").textContent = movie.title;

  $("player").classList.add("active");
  $("player").classList.remove("controls-hidden");

  video.pause();
  video.removeAttribute("src");
  video.load();

  video.src = movie.source;
  video.load();

  video.play()
    .then(showPlayerControls)
    .catch(() => {
      showPlayerControls();
      notify("Press Play. This URL or format may not work in Safari.");
    });
}

function closePlayer() {
  clearTimeout(controlsTimer);

  const video = $("video");
  video.pause();
  video.removeAttribute("src");
  video.load();

  $("player").classList.remove("active", "controls-hidden");
}

$("closePlayer").addEventListener("click", closePlayer);

$("video").addEventListener("play", showPlayerControls);

$("video").addEventListener("pause", () => {
  clearTimeout(controlsTimer);
  $("player").classList.remove("controls-hidden");
});

$("video").addEventListener("click", () => {
  const player = $("player");

  if (player.classList.contains("controls-hidden")) {
    showPlayerControls();
  } else {
    clearTimeout(controlsTimer);
    player.classList.add("controls-hidden");
  }
});

$("togglePlay").addEventListener("click", () => {
  const video = $("video");

  if (video.paused) {
    video.play().then(showPlayerControls).catch(() => {
      notify("Could not play this video.");
    });
  } else {
    video.pause();
  }
});

$("fullScreen").addEventListener("click", async () => {
  const video = $("video");

  try {
    if (video.requestFullscreen) {
      await video.requestFullscreen();
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    } else {
      notify("Fullscreen is not supported here.");
    }
  } catch (error) {
    if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    } else {
      notify("Could not open fullscreen.");
    }
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closePlayer();
    $("adminModal").classList.remove("active");
  }
});

/* START WEBSITE */

applyBanner();
renderMovies();
</script>
