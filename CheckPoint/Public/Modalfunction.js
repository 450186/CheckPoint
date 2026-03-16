(() => {
  const overlay = document.getElementById("game-modal");
  if (!overlay) return;

  let currentCard = null;

  const dialog = overlay.querySelector(".modal");
  const closeBtn = overlay.querySelector(".modal-close");

  const ratingForm = overlay.querySelector("form.rate-form");
  const ratingWrap = document.getElementById("modal-rating-wrap");

  const modalRateInput = document.getElementById("modal-rate-input");
  const starRating = document.getElementById("modal-star-rating");
  const clearRatingBtn = document.getElementById("clear-rating-btn");

  const titleEl = document.getElementById("modal-title");
  const coverEl = document.getElementById("modal-cover");
  const genresEl = document.getElementById("modal-genres");
  const releaseEl = document.getElementById("modal-release");

  const addForm = overlay.querySelector("form.library-form");
  const statusForm = overlay.querySelector("form.status-form");
  const goToGameLink = document.getElementById("modal-go-to-game");

  const addButton = document.getElementById("modal-add-btn");
  const addStatusSelect = document.getElementById("modal-add-status-select");

  const libraryStatusSelect = overlay.querySelector('form.status-form select[name="status"]');

  let lastFocused = null;

  function setStatusLabel(value) {
    switch (value) {
      case "playing":
        return "Playing";
      case "completed":
        return "Completed";
      case "dropped":
        return "Dropped";
      case "wishlist":
      default:
        return "Wishlist";
    }
  }

  function updateBtnLabel() {
    if (!addButton || !addStatusSelect) return;
    addButton.textContent = `+ Add to ${setStatusLabel(addStatusSelect.value)}`;
  }

  function drawStars(value) {
    if (!starRating) return;

    const numericValue = Number(value) || 0;
    const btns = starRating.querySelectorAll(".star-btn");

    btns.forEach((btn, index) => {
      const starNumber = index + 1;
      const icon = btn.querySelector("i");
      if (!icon) return;

      if (numericValue >= starNumber) {
        icon.className = "fa-solid fa-star";
      } else if (numericValue >= starNumber - 0.5) {
        icon.className = "fa-solid fa-star-half-stroke";
      } else {
        icon.className = "fa-regular fa-star";
      }
    });
  }

  async function UpdateRating() {
    const gameId = modalRateInput.closest("form").querySelector('[name="gameId"]').value;
    const rating = modalRateInput.value;

    await fetch("/library/rate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameId, rating }),
    });

    if (currentCard) {
      currentCard.dataset.rating = rating;

      const ratingWrapper = currentCard.querySelector(".card-user-rating");
      if (!ratingWrapper) return;

      ratingWrapper.dataset.rating = rating;

      if (rating) {
        ratingWrapper.innerHTML = `
          <span class="rating-label">Your Rating:</span>
          <div class="card-star-rating">
            <i class="fa-regular fa-star"></i>
            <i class="fa-regular fa-star"></i>
            <i class="fa-regular fa-star"></i>
            <i class="fa-regular fa-star"></i>
            <i class="fa-regular fa-star"></i>
          </div>
        `;

        drawCardStars(ratingWrapper, rating);
      } else {
        ratingWrapper.innerHTML = `<p class="mutedText"><strong>Not rated Yet!</strong></p>`;
      }
    }
  }

  if (addStatusSelect) {
    addStatusSelect.addEventListener("change", updateBtnLabel);
  }

  if (libraryStatusSelect) {
    libraryStatusSelect.addEventListener("change", () => {
      if (!ratingWrap) return;

      if (libraryStatusSelect.value === "wishlist") {
        ratingWrap.style.display = "none";
        if (modalRateInput) modalRateInput.value = "";
        drawStars("");
      } else {
        ratingWrap.style.display = "";
      }
    });
  }

  if (starRating && ratingForm && modalRateInput) {
    starRating.querySelectorAll(".star-btn").forEach((btn, index) => {
      btn.addEventListener("click", async (e) => {
        const rect = btn.getBoundingClientRect();
        const clickX = e.clientX - rect.left; // Get the click position relative to the button
        const isLeftHalf = clickX < rect.width / 2; // Check if the click is in the left half

        const starNumber = index + 1;//check which star is pressed
        const value = isLeftHalf ? starNumber - 0.5 : starNumber;
        //if clicked on the left, subtract 0.5 from the star number, else set to the star number

        modalRateInput.value = value;
        drawStars(value);

        await UpdateRating();
      });
    });
  }

  if (clearRatingBtn && ratingForm && modalRateInput) {
    clearRatingBtn.addEventListener("click", async () => {
      modalRateInput.value = "";
      drawStars("");
      await UpdateRating();
    });
  }

  function openFromCard(card) {
    const id = card.dataset.gameId;
    const name = card.dataset.name || "";
    const cover = card.dataset.cover || "";
    const genres = card.dataset.genres || "";
    const rating = card.dataset.rating || "";
    const release = card.dataset.release || "";
    const status = card.dataset.status || "";

    currentCard = card;

    if (!id) {
      console.warn("Card missing data-game-id:", card);
      return;
    }

    lastFocused = document.activeElement;

    if (titleEl) titleEl.textContent = name;

    if (coverEl) {
      coverEl.src = cover;
      coverEl.alt = name ? `${name} cover` : "Game cover";
    }

    if (genresEl) {
      if (genres) {
        genresEl.innerHTML = `<strong>Genres:</strong> ${genres}`;
        genresEl.style.display = "";
      } else {
        genresEl.innerHTML = "";
        genresEl.style.display = "none";
      }
    }

    if (releaseEl) {
      if (release) {
        releaseEl.innerHTML = `<strong>Release Date:</strong> ${release}`;
        releaseEl.style.display = "";
      } else {
        releaseEl.innerHTML = "";
        releaseEl.style.display = "none";
      }
    }

    if (addForm) {
      addForm.querySelector('input[name="gameId"]').value = id;
      addForm.querySelector('input[name="name"]').value = name;
      addForm.querySelector('input[name="coverUrl"]').value = cover;
      addForm.querySelector('input[name="genres"]').value = genres;
      addForm.querySelector('input[name="rating"]').value = rating;
      addForm.querySelector('input[name="release"]').value = release;
    }

    if (addStatusSelect) {
      addStatusSelect.value = "wishlist";
      updateBtnLabel();
    }

    if (statusForm) {
      const gameIdInput = statusForm.querySelector('input[name="gameId"]');
      const statusSelect = statusForm.querySelector('select[name="status"]');

      if (gameIdInput) gameIdInput.value = id;
      if (statusSelect && status) statusSelect.value = status;
    }

    if (ratingForm) {
      const ratingGameIdInput = ratingForm.querySelector('input[name="gameId"]');
      if (ratingGameIdInput) ratingGameIdInput.value = id;
    }

    if (modalRateInput) {
      modalRateInput.value = rating || "";
    }

    drawStars(rating || "");

    if (ratingWrap) {
      if (status === "wishlist") {
        ratingWrap.style.display = "none";
      } else {
        ratingWrap.style.display = "";
      }
    }

    if (goToGameLink) {
      const from = window.location.pathname + window.location.search;
      goToGameLink.href = `/game/${id}?from=${encodeURIComponent(from)}`;
    }

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (closeBtn) closeBtn.focus();
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

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

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
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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