(() => {
  const overlay = document.getElementById("review-modal");
  if (!overlay) return;

  const dialog = overlay.querySelector(".modal");
  const closeBtn = overlay.querySelector(".review-modal-close");
  const cancelBtn = document.getElementById("review-cancel-btn");
  const openBtn = document.getElementById("open-review-modal-btn");

  const reviewForm = overlay.querySelector("form.review-form");

  const reviewRateInput = document.getElementById("review-rate-input");
  const starRating = document.getElementById("review-star-rating");
  const clearRatingBtn = document.getElementById("review-clear-rating-btn");

  const reviewGameIdInput = document.getElementById("review-game-id");
  const reviewNameInput = document.getElementById("review-cached-name");
  const reviewCoverInput = document.getElementById("review-cached-cover");

  const reviewTitleInput = document.getElementById("review-title-input");
  const reviewTextInput = document.getElementById("review-body-input");

  const reviewModalCover = document.getElementById("review-modal-cover");
  const reviewModalGameName = document.getElementById("review-modal-game-name");

  let lastFocused = null;

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

  async function updateRating() {
    if (!reviewRateInput || !reviewGameIdInput) return;

    const gameId = reviewGameIdInput.value;
    const rating = reviewRateInput.value;

    await fetch("/library/rate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameId, rating }),
    });

    if (openBtn) {
      openBtn.dataset.rating = rating;
    }
  }

  function openModal() {
    if (!openBtn) return;

    lastFocused = document.activeElement;

    const gameId = openBtn.dataset.gameId || "";
    const name = openBtn.dataset.name || "";
    const cover = openBtn.dataset.cover || "";
    const rating = openBtn.dataset.rating || "";

    if (reviewGameIdInput) reviewGameIdInput.value = gameId;
    if (reviewNameInput) reviewNameInput.value = name;
    if (reviewCoverInput) reviewCoverInput.value = cover;

    if (reviewModalCover) {
      reviewModalCover.src = cover;
      reviewModalCover.alt = name ? `${name} cover` : "Game cover";
    }

    if (reviewModalGameName) {
      reviewModalGameName.textContent = name;
    }

    if (reviewRateInput) reviewRateInput.value = rating;
    drawStars(rating);

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (reviewTitleInput) {
      reviewTitleInput.focus();
    } else if (closeBtn) {
      closeBtn.focus();
    }
  }

  function closeModal() {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  if (openBtn) {
    openBtn.addEventListener("click", openModal);
  }

  if (starRating && reviewForm && reviewRateInput) {
    starRating.querySelectorAll(".star-btn").forEach((btn, index) => {
      btn.addEventListener("click", async (e) => {
        const rect = btn.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const isLeftHalf = clickX < rect.width / 2;

        const starNumber = index + 1;
        const value = isLeftHalf ? starNumber - 0.5 : starNumber;

        reviewRateInput.value = value;
        drawStars(value);

        await updateRating();
      });
    });
  }

  if (clearRatingBtn && reviewForm && reviewRateInput) {
    clearRatingBtn.addEventListener("click", async () => {
      reviewRateInput.value = "";
      drawStars("");
      await updateRating();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeModal);
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("show")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    if (!overlay.classList.contains("show")) return;
    if (!dialog) return;

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