(() => {
  const overlay = document.getElementById("game-modal");
  if (!overlay) return;

  const dialog = overlay.querySelector(".modal");
  const closeBtn = overlay.querySelector(".modal-close");

  const titleEl = document.getElementById("modal-title");
  const coverEl = document.getElementById("modal-cover");
  const infoEl = document.getElementById("modal-info");
  const genresEl = document.getElementById("modal-genres");
  const ratingEl = document.getElementById("modal-rating");

  const addForm = overlay.querySelector("form.library-form");
  const goToGameLink = document.getElementById("modal-go-to-game");

  let lastFocused = null;
  let goToUrl = null;

function openFromCard(card) {
  const id = card.dataset.gameId;
  const name = card.dataset.name || "";
  const cover = card.dataset.cover || "";

  if (!id) {
    console.warn("Card missing data-game-id:", card);
    return;
  }

  lastFocused = document.activeElement;

  // Title + cover
  if (titleEl) titleEl.textContent = name;
  if (coverEl) {
    coverEl.src = cover;
    coverEl.alt = name ? `${name} cover` : "Game cover";
  }

  const genres = card.dataset.genres || "";
  const rating = card.dataset.rating || "";
  const release = card.dataset.release || "";

  // Release
  if (release) {
    infoEl.innerHTML = `<strong>Release Date:</strong> ${release}`;
    infoEl.style.display = "";
  } else {
    infoEl.innerHTML = "";
    infoEl.style.display = "none";
  }

  // Genres
  if (genres) {
    genresEl.innerHTML = `<strong>Genres:</strong> ${genres}`;
    genresEl.style.display = "";
  } else {
    genresEl.innerHTML = "";
    genresEl.style.display = "none";
  }

  // Rating
  if (rating) {
    ratingEl.innerHTML = `<strong>Rating:</strong> ${rating}`;
    ratingEl.style.display = "";
  } else {
    ratingEl.innerHTML = "";
    ratingEl.style.display = "none";
  }

  // Hidden form fields
  if (addForm) {
    addForm.querySelector('input[name="gameId"]').value = id;
    addForm.querySelector('input[name="name"]').value = name;
    addForm.querySelector('input[name="coverUrl"]').value = cover;
    addForm.querySelector('input[name="genres"]').value = genres;
    addForm.querySelector('input[name="rating"]').value = rating;
    addForm.querySelector('input[name="release"]').value = release;
  }

  // Go-to link (guard in case element is missing)
  if (goToGameLink) {
    const from = window.location.pathname + window.location.search;
    goToGameLink.href = `/game/${id}?from=${encodeURIComponent(from)}`;
  }

  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  closeBtn.focus();
}

  function closeModal() {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  document.addEventListener("click", (e) => {
    const card = e.target.closest(".game-card, .library-card");
    if (!card) return;

    if (e.target.closest("button, a, input, select, textarea, form")) return;

    openFromCard(card);
  });

  closeBtn.addEventListener("click", closeModal);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    if (!overlay.classList.contains("show")) return;

    const focusables = dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();
