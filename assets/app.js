/* ANYAI Digital Store — app.js
   Zero-backend storefront. Everything renders from window.ANYAI_DATA
   (loaded from assets/products.js). */

(function () {
  "use strict";

  var DATA = window.ANYAI_DATA || { store: {}, categories: [], products: [], faqs: [] };
  var store = DATA.store || {};
  var products = DATA.products || [];
  var TELEGRAM = store.telegram || "https://t.me/";

  /* ---------- helpers ---------- */

  // Escape user-visible strings before injecting into HTML.
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    return "$" + Number(n).toFixed(2);
  }

  // Discount % from compare_at -> price, e.g. 29.99 -> 10.00 gives 67.
  function discountPct(p) {
    if (!p.compare_at || p.compare_at <= p.price) return null;
    return Math.round((1 - p.price / p.compare_at) * 100);
  }

  // Flat brand tile: real logo image when the product has one, otherwise a
  // flat surface tile with the brand initial (no gradients anywhere).
  function mediaInner(p) {
    if (p.logo) {
      return '<img src="' + esc(p.logo) + '" alt="' + esc(p.brand) + ' logo" loading="lazy">';
    }
    var b = String(p.brand || "?").trim();
    return '<span class="media-fallback" aria-hidden="true">' + esc(b.charAt(0).toUpperCase()) + "</span>";
  }

  /* ---------- category mapping ----------
     Products carry a `brand`; the store carries a `categories` list.
     A product belongs to the first category whose name contains its brand
     (case-insensitive). Unmatched products land in "Other". */
  function productCategory(p) {
    var b = String(p.brand || "").toLowerCase().replace(/\s+/g, "");
    if (!b) return "Other";
    for (var i = 0; i < DATA.categories.length; i++) {
      var c = DATA.categories[i].toLowerCase().replace(/\s+/g, "");
      if (c.indexOf(b) !== -1) return DATA.categories[i];
    }
    return "Other";
  }
  products.forEach(function (p) { p._cat = productCategory(p); });

  // Categories that actually have products.
  var activeCats = [];
  DATA.categories.forEach(function (c) {
    if (products.some(function (p) { return p._cat === c; })) activeCats.push(c);
  });
  if (products.some(function (p) { return p._cat === "Other"; })) activeCats.push("Other");

  function catCount(c) {
    return products.filter(function (p) { return p._cat === c; }).length;
  }
  function catLogo(c) {
    var p = products.filter(function (x) { return x._cat === c; })[0];
    return p ? p.logo : null;
  }

  /* ---------- state ---------- */
  var state = { query: "", category: "All" };

  /* ---------- motion: reveals ---------- */
  var REDUCED = false;
  try {
    REDUCED = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) { /* matchMedia unavailable (e.g. test harness) */ }

  var revealObserver = null;
  function initReveals() {
    var els = document.querySelectorAll(".reveal:not(.observed)");
    if (!els.length) return;
    if (REDUCED || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("visible", "observed"); });
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("visible");
            revealObserver.unobserve(en.target);
          }
        });
      }, { threshold: 0.1, rootMargin: "0px 0px -36px 0px" });
    }
    els.forEach(function (el) {
      el.classList.add("observed");
      revealObserver.observe(el);
    });
  }

  /* ---------- header scroll state + nav scrollspy ---------- */
  function initHeaderScroll() {
    var header = document.querySelector(".header");
    if (!header) return;
    function onScroll() {
      header.classList.toggle("scrolled", window.scrollY > 24);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initScrollspy() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    links.forEach(function (a) {
      var id = a.getAttribute("href");
      if (id && id.charAt(0) === "#") map[id.slice(1)] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) { a.classList.remove("active"); });
          var link = map[en.target.id];
          if (link) link.classList.add("active");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) spy.observe(s);
    });
  }

  /* ---------- header / hero / footer store bindings ---------- */
  function bindStore() {
    document.querySelectorAll("[data-store-name]").forEach(function (el) {
      el.textContent = store.name || "Digital Store";
    });
    document.querySelectorAll("[data-tagline]").forEach(function (el) {
      el.textContent = store.tagline || "";
    });
    document.querySelectorAll("[data-support-note]").forEach(function (el) {
      el.textContent = store.support_note || "";
    });
    document.querySelectorAll("[data-telegram]").forEach(function (el) {
      el.setAttribute("href", TELEGRAM);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    });
  }

  /* ---------- stats ---------- */
  function renderStats() {
    var sp = document.getElementById("stat-products");
    var sc = document.getElementById("stat-cats");
    if (sp) sp.textContent = products.length;
    if (sc) sc.textContent = activeCats.length;
  }

  /* ---------- category tiles ---------- */
  var ARROW_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function setCategory(c, scroll) {
    state.category = c;
    renderChips();
    renderGrid();
    if (scroll) {
      var sec = document.getElementById("products");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderCatTiles() {
    var box = document.getElementById("cat-tiles");
    if (!box) return;
    box.innerHTML = activeCats.map(function (c, i) {
      var logo = catLogo(c);
      var icon = logo
        ? '<img src="' + esc(logo) + '" alt="" loading="lazy">'
        : esc(String(c).trim().charAt(0).toUpperCase());
      return (
        '<button class="cat-tile reveal" data-cat="' + esc(c) + '" style="--rd:' + Math.min(i, 11) * 45 + 'ms">' +
          '<span class="cat-arrow" aria-hidden="true">' + ARROW_SVG + "</span>" +
          '<span class="cat-icon">' + icon + "</span>" +
          '<span class="cat-name">' + esc(c) + "</span>" +
          '<span class="cat-meta">' + catCount(c) + " product" + (catCount(c) === 1 ? "" : "s") + "</span>" +
        "</button>"
      );
    }).join("");
    box.querySelectorAll(".cat-tile").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setCategory(btn.getAttribute("data-cat"), true);
      });
    });
    initReveals();
  }

  /* ---------- category chips ---------- */
  function renderChips() {
    var box = document.getElementById("chips");
    if (!box) return;
    var html = '<button class="chip' + (state.category === "All" ? " active" : "") +
      '" data-cat="All">All products</button>';
    activeCats.forEach(function (c) {
      html += '<button class="chip' + (state.category === c ? " active" : "") +
        '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    });
    box.innerHTML = html;
    box.querySelectorAll(".chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setCategory(btn.getAttribute("data-cat"), false);
      });
    });
  }

  /* ---------- hero: quick pills + popular panel ---------- */
  function renderQuickPills() {
    var box = document.getElementById("quick-pills");
    if (!box) return;
    var list = activeCats.slice(0, 6);
    box.innerHTML = list.map(function (c) {
      return '<button class="quick-pill" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
    box.querySelectorAll(".quick-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setCategory(btn.getAttribute("data-cat"), true);
      });
    });
  }

  function renderPopular() {
    var box = document.getElementById("popular-rows");
    if (!box) return;
    // Editorial picks: products flagged with a badge first, then the rest.
    var flagged = products.filter(function (p) { return p.badge; });
    var rest = products.filter(function (p) { return !p.badge; });
    var picks = flagged.concat(rest).slice(0, 4);
    box.innerHTML = picks.map(function (p) {
      return (
        '<div class="popular-row" data-id="' + esc(p.id) + '">' +
          mediaInner(p) +
          '<div><div class="pr-name">' + esc(p.name) + '</div>' +
          '<div class="pr-sub">' + esc(p.access) + "</div></div>" +
          '<span class="pr-price">' + money(p.price) + "</span>" +
        "</div>"
      );
    }).join("");
    box.querySelectorAll(".popular-row").forEach(function (row) {
      row.addEventListener("click", function () {
        openModal(row.getAttribute("data-id"));
      });
    });
  }

  /* ---------- product cards ---------- */
  function badgeHtml(p) {
    var out = [];
    var pct = discountPct(p);
    if (pct) {
      out.push('<span class="badge badge-deal">−' + pct + "%</span>");
    } else if (p.badge) {
      var b = String(p.badge);
      var cls = "badge-new";
      if (/^-\d/.test(b)) cls = "badge-deal";
      else if (/low|stock/i.test(b)) cls = "badge-low";
      else if (/best|deal|sale|off/i.test(b)) cls = "badge-deal";
      out.push('<span class="badge ' + cls + '">' + esc(b) + "</span>");
    }
    return out.length ? '<div class="badges">' + out.join("") + "</div>" : "";
  }

  function metaHtml(p) {
    var stock = "";
    if (p.stock != null) {
      if (p.stock <= 10) {
        stock = '<span class="low-stock">' + esc(String(p.stock)) + " left</span>";
      } else {
        stock = '<span class="in-stock">In stock</span>';
      }
      stock += '<span class="dot" aria-hidden="true">·</span>';
    }
    return (
      '<div class="meta-row">' + stock +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>' +
        "<span>Warranty</span>" +
      "</div>"
    );
  }

  function cardHtml(p, i) {
    var delay = Math.min(i || 0, 11) * 45;
    var soldout = p.stock === 0;
    return (
      '<article class="card reveal' + (soldout ? " soldout" : "") + '" data-id="' + esc(p.id) + '" style="--rd:' + delay + 'ms" tabindex="0" role="button" aria-label="View ' + esc(p.name) + '">' +
        '<div class="card-media">' +
          badgeHtml(p) +
          mediaInner(p) +
        "</div>" +
        '<div class="card-body">' +
          '<div class="kicker">' + esc(p.brand) + "</div>" +
          "<h3>" + esc(p.name) + "</h3>" +
          metaHtml(p) +
          '<div class="card-foot">' +
            '<div><span class="price">' + money(p.price) + "</span>" +
            (p.compare_at ? '<span class="price-old">' + money(p.compare_at) + "</span>" : "") +
            "</div>" +
            '<span class="card-go" aria-hidden="true">' + ARROW_SVG + "</span>" +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function filteredProducts() {
    var q = state.query.trim().toLowerCase();
    return products.filter(function (p) {
      var okCat = state.category === "All" || p._cat === state.category;
      var okQ = !q ||
        String(p.name).toLowerCase().indexOf(q) !== -1 ||
        String(p.brand).toLowerCase().indexOf(q) !== -1 ||
        String(p.description).toLowerCase().indexOf(q) !== -1;
      return okCat && okQ;
    });
  }

  function renderGrid() {
    var grid = document.getElementById("grid");
    var count = document.getElementById("result-count");
    if (!grid) return;
    var list = filteredProducts();
    if (count) {
      count.textContent = list.length === products.length
        ? products.length + " products"
        : list.length + " of " + products.length + " products";
    }
    if (!list.length) {
      grid.innerHTML =
        '<div class="empty"><strong>No products found</strong>' +
        "Try a different search term or category.</div>";
      return;
    }
    grid.innerHTML = list.map(function (p, i) { return cardHtml(p, i); }).join("");
    grid.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", function () { openModal(card.getAttribute("data-id")); });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openModal(card.getAttribute("data-id"));
        }
      });
    });
    initReveals();
  }

  /* ---------- quick-view modal ---------- */
  var overlay, modalBody;

  function openModal(id) {
    var p = products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var pct = discountPct(p);
    var plans = p.plans && p.plans.length ? p.plans : [{ label: "Standard", price: p.price }];
    var planBtns = plans.map(function (pl, i) {
      return '<button class="plan-btn' + (i === 0 ? " active" : "") +
        '" data-price="' + pl.price + '">' + esc(pl.label) + "</button>";
    }).join("");

    modalBody.innerHTML =
      '<div class="modal-media">' + mediaInner(p) + "</div>" +
      '<div class="kicker">' + esc(p.brand) + "</div>" +
      "<h2>" + esc(p.name) + "</h2>" +
      metaHtml(p) +
      '<p class="desc">' + esc(p.description) + "</p>" +
      (p.plans && p.plans.length
        ? '<div class="plan-row" id="plan-row">' + planBtns + "</div>"
        : "") +
      '<div><span class="price" id="modal-price">' + money(plans[0].price) + "</span>" +
      (p.compare_at ? '<span class="price-old">' + money(p.compare_at) + "</span>" : "") +
      (pct ? '<span class="price-old">−' + pct + "%</span>" : "") +
      "</div>" +
      '<div class="spec">' +
        '<div><strong>Delivery</strong><span>' + esc(p.access) + ' — sent after your order completes in our Telegram shop.</span></div>' +
        '<div><strong>Warranty</strong><span>Included for the full validity period. If anything stops working, message us on Telegram and we will replace it.</span></div>' +
        '<div><strong>Support</strong><span>' + esc(store.support_note || "Human support on Telegram before and after your purchase.") + "</span></div>" +
      "</div>" +
      '<a class="btn btn-primary" data-telegram href="' + esc(TELEGRAM) + '" target="_blank" rel="noopener">Buy on Telegram</a>';

    // Plan selector: update the price in place.
    var row = document.getElementById("plan-row");
    if (row) {
      row.querySelectorAll(".plan-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          row.querySelectorAll(".plan-btn").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
          document.getElementById("modal-price").textContent = money(Number(btn.getAttribute("data-price")));
        });
      });
    }

    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
    // Move focus into the dialog for keyboard users.
    var closeBtn = document.getElementById("modal-close");
    if (closeBtn && closeBtn.focus) {
      try { closeBtn.focus({ preventScroll: true }); }
      catch (e) { closeBtn.focus(); }
    }
  }

  function closeModal() {
    overlay.classList.remove("show");
    document.body.style.overflow = "";
  }

  function initModal() {
    overlay = document.getElementById("modal-overlay");
    modalBody = document.getElementById("modal-body");
    if (!overlay) return;
    document.getElementById("modal-close").addEventListener("click", closeModal);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  /* ---------- FAQ accordion ---------- */
  function renderFaq() {
    var box = document.getElementById("faq");
    if (!box) return;
    box.innerHTML = (DATA.faqs || []).map(function (f, i) {
      return (
        '<div class="faq-item reveal" style="--rd:' + Math.min(i, 6) * 60 + 'ms">' +
          '<button class="faq-q" aria-expanded="false">' +
            "<span>" + esc(f.q) + '</span><span class="plus" aria-hidden="true">+</span>' +
          "</button>" +
          '<div class="faq-a"><div class="faq-a-inner"><p>' + esc(f.a) + "</p></div></div>" +
        "</div>"
      );
    }).join("");
    box.querySelectorAll(".faq-item").forEach(function (item) {
      var q = item.querySelector(".faq-q");
      q.addEventListener("click", function () {
        var open = item.classList.contains("open");
        // Close others for a tidy accordion (grid-rows animation is pure CSS).
        box.querySelectorAll(".faq-item.open").forEach(function (o) {
          o.classList.remove("open");
          o.querySelector(".faq-q").setAttribute("aria-expanded", "false");
        });
        if (!open) {
          item.classList.add("open");
          q.setAttribute("aria-expanded", "true");
        }
      });
    });
    initReveals();
  }

  /* ---------- search ---------- */
  function applyQuery(value, scroll) {
    state.query = value;
    var main = document.getElementById("search");
    var hero = document.getElementById("hero-search");
    if (main && main.value !== value) main.value = value;
    if (hero && hero.value !== value) hero.value = value;
    renderGrid();
    if (scroll && value.trim()) {
      var sec = document.getElementById("products");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function initSearch() {
    var input = document.getElementById("search");
    if (input) {
      var t;
      input.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { applyQuery(input.value, true); }, 180);
      });
    }
    var form = document.getElementById("hero-search-form");
    var heroInput = document.getElementById("hero-search");
    if (form && heroInput) {
      heroInput.addEventListener("input", function () { applyQuery(heroInput.value, false); });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        applyQuery(heroInput.value, true);
      });
    }
  }

  /* ---------- "all" reset buttons ---------- */
  function initResetButtons() {
    ["all-cats", "all-products"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", function () {
        state.query = "";
        var main = document.getElementById("search");
        var hero = document.getElementById("hero-search");
        if (main) main.value = "";
        if (hero) hero.value = "";
        setCategory("All", true);
      });
    });
  }

  /* ---------- smooth-scroll nav offset ---------- */
  function initNavOffset() {
    document.querySelectorAll("section[id]").forEach(function (s) {
      s.style.scrollMarginTop = "110px";
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    bindStore();
    renderStats();
    renderQuickPills();
    renderPopular();
    renderCatTiles();
    renderChips();
    renderGrid();
    renderFaq();
    initModal();
    initSearch();
    initResetButtons();
    initNavOffset();
    initHeaderScroll();
    initScrollspy();
    initReveals();
  });
})();
