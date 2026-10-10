"use strict";

const DEMO_VIDEO =
  "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

// Admin email এখানে নিজের email দিয়ে পরিবর্তন করতে পারো।
// মনে রেখো, এটি নিরাপদ server authentication নয়।
const ADMIN_EMAIL = "gmnabid94@gmail.com";

const $ = id => document.getElementById(id);

const DEFAULT_MOVIES = [{
  id: 1,
  title: "Big Buck Bunny (Demo)",
  description: "Demo video. Add your own videos from the Account page.",
  thumbnail: "https://image.tmdb.org/t/p/w500/9PFonBhy4cQy7Jz20NpMygczOkv.jpg",
  video: DEMO_VIDEO,
  demo: true,
  createdAt: 0
}];

let movies = [];
let myList = JSON.parse(localStorage.getItem("gmflixMyList") || "[]");
let history = JSON.parse(localStorage.getItem("gmflixHistory") || "[]");
let requests = JSON.parse(localStorage.getItem("gmflixRequests") || "[]");
let currentUser = JSON.parse(localStorage.getItem("gmflixUser") || "null");

let profileImage = "";
let thumbData = "";
let selectedVideoFile = null;
let currentMovie = null;
let db = null;
let toastTimer = null;

function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2800);
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function showPage(page) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.toggle("active", p.id === page);
  });

  document.querySelectorAll(".tab-item").forEach(t => {
    t.classList.toggle("active", t.dataset.page === page);
  });

  $("searchInput").value = "";
  renderMovies();

  if (page === "history") renderHistory();
  if (page === "request") renderRequests();
  if (page === "account") renderAccount();

  window.scrollTo(0, 0);
}

/* DATABASE */

function openDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unsupported"));
      return;
    }

    const req = indexedDB.open("GMFLIX_DB", 1);

    req.onupgradeneeded = () => {
      const database = req.result;

      if (!database.objectStoreNames.contains("movies")) {
        database.createObjectStore("movies", {
          keyPath: "id"
        });
      }
    };

    req.onsuccess = () => resolve(req.result);

    req.onerror = () => {
      reject(req.error || new Error("Database error"));
    };
  });
}

function dbPut(movie) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("movies", "readwrite");

    tx.objectStore("movies").put(movie);

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Save failed"));
    tx.onabort = () => reject(tx.error || new Error("Save cancelled"));
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const req = db
      .transaction("movies", "readonly")
      .objectStore("movies")
      .getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("movies", "readwrite");

    tx.objectStore("movies").delete(id);

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error("Delete failed"));
  });
}

async function loadMovies() {
  try {
    db = await openDB();

    const saved = await dbGetAll();

    movies = [
      ...DEFAULT_MOVIES,
      ...saved
        .filter(m => m.id !== 1)
        .map(m => ({
          ...m,
          video: m.videoBlob
            ? URL.createObjectURL(m.videoBlob)
            : ""
        }))
    ];
  } catch (error) {
    movies = [...DEFAULT_MOVIES];
    showToast("Browser storage unavailable. Uploaded movies cannot be saved.");
  }

  renderMovies();
  renderAdminMovies();
}

/* MOVIES AND SEARCH */

function movieById(id) {
  return movies.find(m => String(m.id) === String(id));
}

function posterCard(movie) {
  return `
    <div class="poster-card"
      onclick="openMovie('${safeText(movie.id)}')">

      <img class="poster"
        src="${safeText(movie.thumbnail || "")}"
        alt="${safeText(movie.title)}"
        loading="lazy"
        onerror="this.style.visibility='hidden'">

      <div class="poster-name">
        ${safeText(movie.title)}
      </div>
    </div>
  `;
}

function renderMovies(query = "") {
  const q = query.trim().toLowerCase();

  const found = movies.filter(m =>
    !q ||
    m.title.toLowerCase().includes(q) ||
    String(m.description || "").toLowerCase().includes(q)
  );

  $("trending").innerHTML = found.length
    ? found.map(posterCard).join("")
    : '<div class="empty">No movies found.</div>';

  const saved = myList
    .map(id => movieById(id))
    .filter(Boolean);

  $("mylist").innerHTML = saved.length
    ? saved.map(posterCard).join("")
    : '<div class="empty">Your list is empty. Add a movie to your list.</div>';

  $("searchMessage").style.display = q ? "block" : "none";

  $("searchMessage").textContent = q
    ? `${found.length} result(s) found`
    : "";
}

$("searchInput").addEventListener("input", event => {
  renderMovies(event.target.value);
});

/* MY LIST */

function addToList(id) {
  if (myList.includes(id)) {
    myList = myList.filter(x => x !== id);
    showToast("My List থেকে সরানো হয়েছে");
  } else {
    myList.push(id);
    showToast("My List-এ যোগ হয়েছে");
  }

  localStorage.setItem("gmflixMyList", JSON.stringify(myList));
  renderMovies($("searchInput").value);
}

function openMovie(id) {
  const movie = movieById(id);

  if (!movie) {
    showToast("Movie পাওয়া যায়নি");
    return;
  }

  if (
    movie.hasSeason &&
    Array.isArray(movie.episodes) &&
    movie.episodes.length
  ) {
    showSeasons(movie);
    return;
  }

  const action = window.confirm(
    `${movie.title}\n\nOK = Play\nCancel = My List-এ যোগ/সরানোর option`
  );

  if (!action) {
    addToList(movie.id);
    return;
  }

  playMovie(movie);
}

/* VIDEO PLAYER */

function playMovie(movie) {
  currentMovie = movie;

  $("playerTitle").textContent = movie.title;
  $("player").classList.add("active");
  $("playerMenu").classList.remove("active");

  const video = $("mainVideo");

  video.pause();
  video.removeAttribute("src");

  video.querySelectorAll("source").forEach(source => {
    source.remove();
  });

  video.src = movie.video || DEMO_VIDEO;
  video.load();

  video.play().catch(() => {
    showToast("ভিডিও চালাতে ▶ চাপুন।");
  });

  saveHistory(movie);
  renderHistory();

  $("playPauseBtn").textContent = "Ⅱ";
}

function closePlayer() {
  const video = $("mainVideo");

  video.pause();
  video.removeAttribute("src");
  video.load();

  $("player").classList.remove("active");
  $("playerMenu").classList.remove("active");

  currentMovie = null;
}

function togglePlay() {
  const video = $("mainVideo");

  if (video.paused) {
    video.play()
      .then(() => {
        $("playPauseBtn").textContent = "Ⅱ";
      })
      .catch(() => {
        showToast("ভিডিও চালু করা যায়নি");
      });
  } else {
    video.pause();
    $("playPauseBtn").textContent = "▶";
  }
}

function skip(seconds) {
  const video = $("mainVideo");

  if (Number.isFinite(video.duration)) {
    video.currentTime = Math.max(
      0,
      Math.min(video.duration, video.currentTime + seconds)
    );
  }
}

function fmtTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = Math.floor(seconds % 60);

  if (h) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  return `${m}:${String(sec).padStart(2, "0")}`;
}

$("mainVideo").addEventListener("timeupdate", () => {
  const video = $("mainVideo");

  $("progressFill").style.width =
    (video.duration ? 100 * video.currentTime / video.duration : 0) + "%";

  $("currentTime").textContent = fmtTime(video.currentTime);
  $("duration").textContent = fmtTime(video.duration);
});

$("mainVideo").addEventListener("play", () => {
  $("playPauseBtn").textContent = "Ⅱ";
});

$("mainVideo").addEventListener("pause", () => {
  $("playPauseBtn").textContent = "▶";
});

$("progressBar").addEventListener("click", event => {
  const video = $("mainVideo");
  const rect = event.currentTarget.getBoundingClientRect();

  if (Number.isFinite(video.duration) && rect.width) {
    video.currentTime = Math.max(
      0,
      Math.min(
        video.duration,
        (event.clientX - rect.left) / rect.width * video.duration
      )
    );
  }
});

$("progressBar").addEventListener("keydown", event => {
  if (event.key === "ArrowRight") skip(5);
  if (event.key === "ArrowLeft") skip(-5);
});

function toggleFit() {
  const video = $("mainVideo");

  video.style.objectFit =
    video.style.objectFit === "cover" ? "contain" : "cover";
}

function toggleFullscreen() {
  const player = $("player");

  if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  } else if (player.requestFullscreen) {
    player.requestFullscreen().catch(() => {
      showToast("Fullscreen unavailable; landscape করে দেখুন।");
    });
  } else {
    showToast("এই browser fullscreen সমর্থন করে না।");
  }
}

function toggleMenu(id) {
  $(id).classList.toggle("active");
}

/* WATCH HISTORY */

function saveHistory(movie) {
  history = history.filter(x => x.id !== movie.id);

  history.unshift({
    id: movie.id,
    title: movie.title,
    thumbnail: movie.thumbnail,
    watchedAt: Date.now()
  });

  history = history.slice(0, 50);

  localStorage.setItem("gmflixHistory", JSON.stringify(history));
}

function renderHistory() {
  $("historyList").innerHTML = history.length
    ? history.map(h => `
      <div class="history-item"
        onclick="openMovie('${safeText(h.id)}')">

        <img class="history-thumb"
          src="${safeText(h.thumbnail || "")}"
          alt=""
          onerror="this.style.visibility='hidden'">

        <div>
          <strong>${safeText(h.title)}</strong>
          <div class="muted">
            ${new Date(h.watchedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    `).join("")
    : '<div class="empty" style="padding:16px">No watch history yet.</div>';
}

/* MOVIE REQUESTS */

function submitRequest() {
  const name = $("reqName").value.trim();
  const comment = $("reqComment").value.trim();

  if (!name) {
    showToast("Movie name লিখুন");
    return;
  }

  requests.unshift({
    id: Date.now(),
    name,
    comment,
    createdAt: Date.now()
  });

  localStorage.setItem("gmflixRequests", JSON.stringify(requests));

  $("reqName").value = "";
  $("reqComment").value = "";

  renderRequests();
  showToast("Request এই browser-এ save হয়েছে");
}

function renderRequests() {
  $("requestList").innerHTML = requests.length
    ? requests.map(r => `
      <div class="request-card">
        <strong>${safeText(r.name)}</strong>
        <p>${safeText(r.comment || "")}</p>
        <div class="muted">
          ${new Date(r.createdAt).toLocaleDateString()}
        </div>
      </div>
    `).join("")
    : '<div class="empty">এখনও কোনো request নেই।</div>';
}

/* ACCOUNT AND PROFILE */

$("profilePic").addEventListener("change", event => {
  readImage(event.target.files[0], data => {
    profileImage = data;

    $("profilePreview").src = data;
    $("profilePreview").style.display = "block";
    $("profilePlaceholder").style.display = "none";
  });
});

function readImage(file, callback) {
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("একটি image file বাছুন");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => callback(reader.result);
  reader.onerror = () => showToast("Image পড়া যায়নি");

  reader.readAsDataURL(file);
}

function login() {
  const name = $("loginName").value.trim();
  const email = $("loginEmail").value.trim().toLowerCase();
  const pass = $("loginPass").value;

  if (!name || !email || !pass) {
    showToast("সব field পূরণ করুন");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("সঠিক email দিন");
    return;
  }

  currentUser = {
    name,
    email,
    avatar: profileImage
  };

  localStorage.setItem("gmflixUser", JSON.stringify(currentUser));

  renderAccount();
  showToast("Local profile তৈরি হয়েছে");
}

function logout() {
  currentUser = null;

  localStorage.removeItem("gmflixUser");

  renderAccount();
  showToast("Logout হয়েছে");
}

function renderAccount() {
  const logged = !!currentUser;

  $("loginBox").style.display = logged ? "none" : "block";
  $("userPanel").style.display = logged ? "block" : "none";

  if (!logged) return;

  $("userName").textContent = currentUser.name;
  $("userEmail").textContent = currentUser.email;

  $("userAvatar").src = currentUser.avatar ||
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='100%25' height='100%25' fill='%23333'/%3E%3Ctext x='50%25' y='58%25' text-anchor='middle' font-size='40' fill='white'%3E☺%3C/text%3E%3C/svg%3E";

  const admin = currentUser.email === ADMIN_EMAIL;

  $("adminPanel").style.display = admin ? "block" : "none";

  if (admin) renderAdminMovies();
}

/* ADMIN: ADD MOVIE */

$("thumbInput").addEventListener("change", event => {
  readImage(event.target.files[0], data => {
    thumbData = data;

    $("thumbPreview").src = data;
    $("thumbPreview").style.display = "block";
  });
});

$("videoInput").addEventListener("change", event => {
  selectedVideoFile = event.target.files[0] || null;

  $("videoFileName").textContent = selectedVideoFile
    ? `${selectedVideoFile.name} (${(selectedVideoFile.size / 1024 / 1024).toFixed(1)} MB)`
    : "";

  if (selectedVideoFile && selectedVideoFile.size > 250 * 1024 * 1024) {
    showToast("বড় video browser storage-এ save নাও হতে পারে");
  }
});

async function uploadMovie() {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
    showToast("Admin profile প্রয়োজন");
    return;
  }

  const title = $("movieTitle").value.trim();
  const description = $("movieDesc").value.trim();

  if (!title || !thumbData || !selectedVideoFile) {
    showToast("Title, thumbnail ও video—তিনটিই দিন");
    return;
  }

  if (!selectedVideoFile.type.startsWith("video/")) {
    showToast("সঠিক video file দিন");
    return;
  }

  const btn = $("uploadButton");

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    if (!db) db = await openDB();

    const movie = {
      id: Date.now(),
      title,
      description,
      thumbnail: thumbData,
      videoBlob: selectedVideoFile,
      video: "",
      createdAt: Date.now()
    };

    await dbPut(movie);

    movies.push({
      ...movie,
      video: URL.createObjectURL(selectedVideoFile)
    });

    showToast("Movie এই browser-এ save হয়েছে");

    resetMovieForm();
    renderMovies();
    renderAdminMovies();

  } catch (error) {
    console.error(error);
    showToast("Save failed. Storage limit পরীক্ষা করুন।");

  } finally {
    btn.disabled = false;
    btn.textContent = "Add Movie";
  }
}

function resetMovieForm() {
  $("movieTitle").value = "";
  $("movieDesc").value = "";

  $("thumbInput").value = "";
  $("videoInput").value = "";

  $("thumbPreview").removeAttribute("src");
  $("thumbPreview").style.display = "none";

  $("videoFileName").textContent = "";

  thumbData = "";
  selectedVideoFile = null;
}

/* ADMIN: MANAGE MOVIES */

function renderAdminMovies() {
  $("adminMovieList").innerHTML = "";

  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return;

  for (const movie of movies) {
    const el = document.createElement("div");
    el.className = "admin-movie";

    const img = document.createElement("img");
    img.src = movie.thumbnail || "";
    img.alt = "";

    const meta = document.createElement("div");
    meta.className = "movie-meta";

    const title = document.createElement("strong");
    title.textContent = movie.title;

    const desc = document.createElement("div");
    desc.className = "muted";
    desc.textContent = movie.demo
      ? "Demo video"
      : "Saved in this browser";

    meta.append(title, desc);
    el.append(img, meta);

    if (!movie.demo) {
      const del = document.createElement("button");

      del.className = "delete-movie";
      del.textContent = "Delete";
      del.onclick = () => deleteMovie(movie.id);

      el.append(del);
    }

    $("adminMovieList").append(el);
  }
}

async function deleteMovie(id) {
  if (!confirm("এই browser থেকে movie delete করবেন?")) return;

  try {
    if (db) await dbDelete(id);

    movies = movies.filter(m => m.id !== id);
    myList = myList.filter(x => x !== id);
    history = history.filter(x => x.id !== id);

    localStorage.setItem("gmflixMyList", JSON.stringify(myList));
    localStorage.setItem("gmflixHistory", JSON.stringify(history));

    renderMovies();
    renderHistory();
    renderAdminMovies();

    showToast("Movie delete হয়েছে");

  } catch (error) {
    showToast("Delete করা যায়নি");
  }
}

/* SEASONS */

function showSeasons(movie) {
  $("seasonMovieTitle").textContent = movie.title;

  $("seasonList").innerHTML =
    '<div class="empty">এই movie-তে episode যোগ করা হয়নি। Admin-এ প্রতিটি episode আলাদা movie হিসেবে যোগ করুন।</div>';

  showPage("seasonPage");
}

/* KEYBOARD CONTROLS */

window.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    $("player").classList.contains("active")
  ) {
    closePlayer();
  }

  if (
    event.code === "Space" &&
    $("player").classList.contains("active") &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    event.preventDefault();
    togglePlay();
  }
});

/* START GMFLIX */

(async function init() {
  await loadMovies();
  renderHistory();
  renderRequests();
  renderAccount();
})();
