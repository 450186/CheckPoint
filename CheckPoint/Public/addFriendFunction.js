(() => {
    const overlay = document.getElementById("friend-modal");
    if(!overlay) return;

    const dialog = overlay.querySelector(".modal");
    const openBtn = document.getElementById("open-friend-modal-btn");
    const closeBtn = overlay.querySelector(".modal-close");
    const cancelBtn = document.getElementById("friend-cancel-btn")
    const searchInput = document.getElementById("friend-search-input");

    let lastFocused = null;

    function openModal() {
        lastFocused = document.activeElement;
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        if(searchInput) searchInput.focus();
    }
    function closeModal() {
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        if(lastFocused && typeof lastFocused.focus === "function") {
            lastFocused.focus();
        }
    }

    if(openBtn) openBtn.addEventListener("click", openModal);
    if(closeBtn) closeBtn.addEventListener("click", closeModal);
    if(cancelBtn) cancelBtn.addEventListener("click", closeModal);

    overlay.addEventListener("click", (e) => {
        if(e.target === overlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
        if(e.key === "Escape" && overlay.classList.contains("show")) closeModal();
    })

    document.addEventListener("keydown", (e) => {
        if(e.key !== "Tab") return;
        if(!overlay.classList.contains("show")) return
        if(!dialog) return;

        const focusables = dialog.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if(!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        
        if(e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if(!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    })
})();