// Konfigurasi Sheet
const SHEET_CONFIG = {
  harga: { gid: "216173443", name: "Harga" },
  runningText: { gid: "1779766141", name: "RunningText" },
  iklan: { gid: "1303897065", name: "Iklan" },
};

// Base URL untuk Google Sheets
const SHEET_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFH0squhL_c2KoNryfBrysWZEKTTUpthg_1XVE-fT3r7-ew1_lkbFqENefrlBLHClis53FyDdNiUkh/pub";

// State aplikasi
const appState = {
  tableData: {},
  adsData: [],
  currentVideoIndex: 0,
  videoPlayed: false,
  isYouTubeAPILoaded: false,
  youtubePlayer: null,
  userInteracted: false,
  autoplayAttempted: false,
  videoRotationInterval: null,
  tableRotationIntervals: {},
  tablePages: {
    emas: { currentPage: 0, itemsPerPage: 5 },
    antam: { currentPage: 0, itemsPerPage: 5 },
    archi: { currentPage: 0, itemsPerPage: 5 },
  },
};

// Helper functions
function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Format nama produk agar lebih pendek dan menarik
function formatProductName(name) {
  if (!name) return "-";

  const shortNames = {
    emas: "EMAS",
    antam: "ANTAM",
    archi: "ARCHI",
    lokal: "LOKAL",
    import: "IMPORT",
    premium: "PREMIUM",
    standar: "STD",
    kadar: "KD",
    gram: "GR",
    ounce: "OZ",
    kilogram: "KG",
    batangan: "BATANG",
    koin: "KOIN",
    perhiasan: "HIAS",
    laminated: "LAMIN",
    certified: "CERT",
    uncertified: "UNCERT",
    logam: "LM",
    mulia: "ML",
    investasi: "INVEST",
    tabungan: "TAB",
    " fisik": " F",
    " digital": " D",
  };

  let formatted = name.toUpperCase();

  // Ganti kata-kata panjang dengan singkatan
  Object.keys(shortNames).forEach((key) => {
    const regex = new RegExp(key, "gi");
    formatted = formatted.replace(regex, shortNames[key]);
  });

  // Hapus karakter khusus dan batasi panjang
  formatted = formatted
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Jika masih terlalu panjang, ambil 2-3 kata pertama
  const words = formatted.split(/\s+/);
  if (words.length > 3) {
    formatted = words.slice(0, 3).join(" ");
  }

  return formatted || name.substring(0, 12);
}

// Update tanggal dan waktu
function updateDateTime() {
  const now = new Date();

  // Format tanggal: DD/MM/YYYY
  const dateOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
  const formattedDate = now.toLocaleDateString("id-ID", dateOptions);

  // Format waktu: HH:MM:SS
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const formattedTime = `${hours}:${minutes}:${seconds}`;

  document.getElementById("currentDate").textContent = formattedDate;
  document.getElementById("currentTime").textContent = formattedTime;
}

// Fungsi untuk menyesuaikan layout berdasarkan ukuran layar
function adjustLayoutForScreenSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Untuk layar sangat lebar (Smart TV, desktop besar)
  if (width >= 1920) {
    document.body.style.zoom = "100%";
    // Optimalkan jumlah item per halaman untuk layar besar
    appState.tablePages.emas.itemsPerPage = 7;
    appState.tablePages.antam.itemsPerPage = 7;
    appState.tablePages.archi.itemsPerPage = 7;
  } 
  // Untuk desktop standar
  else if (width >= 1200) {
    document.body.style.zoom = "100%";
    appState.tablePages.emas.itemsPerPage = 5;
    appState.tablePages.antam.itemsPerPage = 5;
    appState.tablePages.archi.itemsPerPage = 5;
  }
  // Untuk tablet
  else if (width >= 768) {
    document.body.style.zoom = "100%";
    appState.tablePages.emas.itemsPerPage = 4;
    appState.tablePages.antam.itemsPerPage = 4;
    appState.tablePages.archi.itemsPerPage = 4;
  }
  // Untuk mobile
  else {
    document.body.style.zoom = "100%";
    appState.tablePages.emas.itemsPerPage = 3;
    appState.tablePages.antam.itemsPerPage = 3;
    appState.tablePages.archi.itemsPerPage = 3;
  }
  
  // Refresh tampilan tabel dengan pengaturan baru
  displayAllTables();
}

// Inisialisasi aplikasi
document.addEventListener("DOMContentLoaded", function () {
  console.log("Memuat aplikasi informasi harga...");

  // Update tanggal dan waktu setiap detik
  updateDateTime();
  setInterval(updateDateTime, 1000);

  // Setup event listeners untuk interaksi pengguna
  setupUserInteractionListeners();

  // Setup navigation buttons
  setupTableNavigation();

  // Setup skip button
  document.getElementById("skipBtn").addEventListener("click", playNextVideo);

  // Panggil fungsi penyesuaian layout
  adjustLayoutForScreenSize();

  // Load data
  loadPriceData();
  loadRunningText();
  loadAdsData();

  // Load YouTube API
  loadYouTubeAPI();
});

// Setup table navigation
function setupTableNavigation() {
  // Setup navigation buttons for all tables
  ["emas", "antam", "archi"].forEach((tableType) => {
    const prevBtn = document.querySelector(
      `.prev-btn[data-table="${tableType}"]`
    );
    const nextBtn = document.querySelector(
      `.next-btn[data-table="${tableType}"]`
    );

    if (prevBtn) {
      prevBtn.addEventListener("click", () => navigateTable(tableType, "prev"));
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => navigateTable(tableType, "next"));
    }
  });
}

// Navigate table pages
function navigateTable(tableType, direction) {
  const tableState = appState.tablePages[tableType];
  const data = appState.tableData[tableType];

  if (!data || data.length === 0) return;

  const totalPages = Math.ceil(data.length / tableState.itemsPerPage);

  if (direction === "prev") {
    tableState.currentPage =
      (tableState.currentPage - 1 + totalPages) % totalPages;
  } else {
    tableState.currentPage = (tableState.currentPage + 1) % totalPages;
  }

  displayTable(
    `priceTable${tableType.charAt(0).toUpperCase() + tableType.slice(1)}`,
    data,
    tableType
  );
}

// Start automatic rotation for tables
function startTableRotation() {
  ["emas", "antam", "archi"].forEach((tableType) => {
    // Clear existing interval
    if (appState.tableRotationIntervals[tableType]) {
      clearInterval(appState.tableRotationIntervals[tableType]);
    }

    // Start new interval (6 seconds)
    appState.tableRotationIntervals[tableType] = setInterval(() => {
      const data = appState.tableData[tableType];
      if (data && data.length > appState.tablePages[tableType].itemsPerPage) {
        navigateTable(tableType, "next");
      }
    }, 6000);
  });
}

// Setup listeners untuk interaksi pengguna
function setupUserInteractionListeners() {
  const interactionEvents = ["click", "touchstart", "keydown", "scroll"];

  interactionEvents.forEach((eventType) => {
    document.addEventListener(eventType, handleUserInteraction, {
      once: false,
      passive: true,
    });
  });
}

function handleUserInteraction() {
  if (!appState.userInteracted) {
    console.log(
      "Interaksi pengguna terdeteksi - autoplay dengan suara diizinkan"
    );
    appState.userInteracted = true;

    // Coba play video jika sedang ditampilkan
    if (
      appState.youtubePlayer &&
      document.getElementById("videoContainer").classList.contains("active")
    ) {
      playVideoWithSound();
    }
  }
}

// Load YouTube API
function loadYouTubeAPI() {
  if (!appState.isYouTubeAPILoaded) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    appState.isYouTubeAPILoaded = true;
  }
}

// Start video rotation
function startVideoRotation() {
  // Clear existing interval
  if (appState.videoRotationInterval) {
    clearInterval(appState.videoRotationInterval);
  }

  // Rotate videos every 30 seconds
  appState.videoRotationInterval = setInterval(() => {
    if (hasActiveAds() && appState.videoPlayed) {
      playNextVideo();
    }
  }, 30000);
}

// Cek apakah ada iklan aktif
function hasActiveAds() {
  return (
    appState.adsData.filter(
      (ad) =>
        ad.status &&
        ad.status.toLowerCase() === "active" &&
        ad.video_url &&
        isValidYouTubeUrl(ad.video_url)
    ).length > 0
  );
}

// Validasi URL YouTube
function isValidYouTubeUrl(url) {
  if (!url) return false;
  const cleanUrl = url.trim();
  if (!cleanUrl) return false;

  const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/;
  return youtubePattern.test(cleanUrl);
}

// Tampilkan video
function showVideo() {
  const activeAds = appState.adsData.filter(
    (ad) =>
      ad.status &&
      ad.status.toLowerCase() === "active" &&
      ad.video_url &&
      isValidYouTubeUrl(ad.video_url)
  );

  if (activeAds.length === 0) {
    console.log("Tidak ada iklan aktif");
    appState.videoPlayed = true;
    return;
  }

  // Reset index jika melebihi jumlah video
  if (appState.currentVideoIndex >= activeAds.length) {
    appState.currentVideoIndex = 0;
  }

  const selectedAd = activeAds[appState.currentVideoIndex];
  const videoContainer = document.getElementById("videoContainer");
  const videoWrapper = document.querySelector(".video-wrapper");

  console.log(
    `Menampilkan video: ${appState.currentVideoIndex + 1} dari ${
      activeAds.length
    }`
  );

  // Update video counter
  document.getElementById("videoCounter").textContent = `${
    appState.currentVideoIndex + 1
  }/${activeAds.length}`;

  // Bersihkan dan buat container baru
  videoWrapper.innerHTML = "";

  // Buat container untuk video
  const videoContainerDiv = document.createElement("div");
  videoContainerDiv.id = "player";
  videoContainerDiv.style.width = "100%";
  videoContainerDiv.style.height = "100%";
  videoContainerDiv.style.borderRadius = "10px";
  videoContainerDiv.style.overflow = "hidden";
  videoContainerDiv.style.position = "relative";

  videoWrapper.appendChild(videoContainerDiv);

  // Tampilkan container video
  videoContainer.classList.add("active");
  appState.videoPlayed = true;

  // Setup YouTube Player
  setTimeout(() => {
    setupYouTubePlayer(selectedAd.video_url);
  }, 500);
}

// Setup YouTube Player untuk autoplay yang lebih agresif
function setupYouTubePlayer(videoUrl) {
  // Ekstrak video ID dari URL
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    console.error("Tidak dapat mengekstrak Video ID dari URL:", videoUrl);
    return;
  }

  // Reset autoplay attempt
  appState.autoplayAttempted = false;

  // Buat player YouTube dengan autoplay muted (strategi yang lebih diterima browser)
  appState.youtubePlayer = new YT.Player("player", {
    height: "100%",
    width: "100%",
    videoId: videoId,
    playerVars: {
      autoplay: 1, // Autoplay dengan mute
      mute: 1, // Mute untuk autoplay
      enablejsapi: 1,
      rel: 0,
      playsinline: 1,
      controls: 0, // Sembunyikan kontrol
      modestbranding: 1,
      showinfo: 0,
      iv_load_policy: 3, // Sembunyikan anotasi
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
}

// Ekstrak Video ID dari URL YouTube
function extractVideoId(url) {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
}

// YouTube Player Callbacks
function onPlayerReady(event) {
  console.log("YouTube Player siap");

  // Coba autoplay dengan mute terlebih dahulu
  attemptAutoplay(event.target);
}

function attemptAutoplay(player) {
  if (appState.autoplayAttempted) return;

  appState.autoplayAttempted = true;

  try {
    // Langsung play dengan mute (strategi yang paling diterima)
    player.playVideo();
    console.log("Video diputar dengan autoplay (muted)");

    // Set timeout untuk unmute jika user sudah berinteraksi
    setTimeout(() => {
      if (appState.userInteracted) {
        try {
          player.unMute();
          console.log("Suara diaktifkan setelah interaksi pengguna");
        } catch (error) {
          console.log("Tidak dapat mengaktifkan suara:", error);
        }
      }
    }, 1000);
  } catch (error) {
    console.log("Autoplay diblokir:", error);
    showInteractivePlayButton(player);
  }
}

function playVideoWithSound() {
  if (
    appState.youtubePlayer &&
    appState.youtubePlayer.unMute &&
    appState.youtubePlayer.playVideo
  ) {
    try {
      // Unmute terlebih dahulu
      appState.youtubePlayer.unMute();

      // Jika video tidak sedang diputar, play lagi
      if (appState.youtubePlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
        appState.youtubePlayer.playVideo();
      }

      console.log("Video diputar dengan suara setelah interaksi");

      // Sembunyikan tombol play jika ada
      const playBtn = document.querySelector(".play-btn");
      if (playBtn) {
        playBtn.style.display = "none";
      }
    } catch (error) {
      console.log("Gagal memutar video dengan suara:", error);
    }
  }
}

function onPlayerStateChange(event) {
  console.log("Status Player berubah:", event.data);

  // Jika video mulai diputar
  if (event.data === YT.PlayerState.PLAYING) {
    console.log("Video mulai diputar");

    // Jika user sudah berinteraksi, unmute
    if (appState.userInteracted) {
      try {
        event.target.unMute();
        console.log("Suara diaktifkan");
      } catch (error) {
        console.log("Tidak dapat mengaktifkan suara:", error);
      }
    }
  }

  // Jika video selesai, lanjut ke video berikutnya
  if (event.data === YT.PlayerState.ENDED) {
    console.log("Video selesai, melanjutkan ke video berikutnya...");
    playNextVideo();
  }
}

function onPlayerError(event) {
  console.error("Error YouTube Player:", event.data);
  // Jika error, coba video berikutnya
  setTimeout(playNextVideo, 2000);
}

// Tampilkan tombol play interaktif
function showInteractivePlayButton(player) {
  const videoWrapper = document.querySelector(".video-wrapper");

  // Hapus tombol play yang sudah ada
  const existingBtn = videoWrapper.querySelector(".play-btn");
  if (existingBtn) existingBtn.remove();

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";
  playBtn.innerHTML = `
        <i class="fas fa-play" style="margin-right: 8px;"></i>
        PUTAR VIDEO
    `;

  playBtn.onclick = function () {
    handleUserInteraction();
    playVideoWithSound();
    this.style.display = "none";
  };

  videoWrapper.appendChild(playBtn);
}

// Putar video berikutnya
function playNextVideo() {
  console.log("Memainkan video berikutnya...");

  // Pindah ke video berikutnya
  appState.currentVideoIndex++;

  const activeAds = appState.adsData.filter(
    (ad) =>
      ad.status &&
      ad.status.toLowerCase() === "active" &&
      ad.video_url &&
      isValidYouTubeUrl(ad.video_url)
  );

  if (appState.currentVideoIndex < activeAds.length) {
    // Masih ada video berikutnya, tampilkan
    showVideo();
  } else {
    // Semua video sudah ditampilkan, reset dan mulai dari awal
    appState.currentVideoIndex = 0;
    showVideo();
  }
}

// Load data harga
async function loadPriceData() {
  try {
    console.log("Memuat data harga...");
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.harga.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const data = parseCSVToJSON(csvText);

    appState.tableData.emas = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "emas"
    );
    appState.tableData.antam = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "antam"
    );
    appState.tableData.archi = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "archi"
    );

    console.log(
      `Data loaded - Emas: ${appState.tableData.emas.length}, Antam: ${appState.tableData.antam.length}, Archi: ${appState.tableData.archi.length}`
    );

    displayAllTables();

    // Start automatic rotation for tables
    startTableRotation();

    // Tampilkan video jika ada iklan aktif
    if (hasActiveAds() && !appState.videoPlayed) {
      setTimeout(() => {
        showVideo();
        startVideoRotation();
      }, 2000);
    }
  } catch (error) {
    console.error("Error loading CSV data:", error);
    showError();
  }
}

// Load running text
async function loadRunningText() {
  try {
    console.log("Memuat running text...");
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.runningText.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const data = parseRunningTextCSV(csvText);

    processRunningTextData(data);
  } catch (error) {
    console.error("Error loading running text:", error);
    document.getElementById("marqueeText").textContent =
      "Harga emas terkini - Informasi terupdate setiap hari - PantesMall Bandung";
  }
}

// Load data iklan
async function loadAdsData() {
  try {
    console.log("Memuat data iklan...");
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.iklan.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    appState.adsData = parseAdsCSV(csvText);
    console.log("Ads data loaded:", appState.adsData.length, "iklan");
  } catch (error) {
    console.error("Error loading ads data:", error);
  }
}

// Parser untuk data iklan
function parseAdsCSV(csvText) {
  const lines = csvText.trim().split("\n");

  if (lines.length < 1) return [];

  if (lines.length === 1) {
    const values = lines[0].split(",").map((v) => v.trim());
    if (values.length >= 7) {
      return [
        {
          judul: values[0],
          deskripsi: values[1],
          video_url: values[2],
          gambar_url: values[3],
          link1: values[4],
          link2: values[5],
          status: values[6],
        },
      ];
    }
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj = {};

      headers.forEach((header, index) => {
        if (index < values.length) {
          obj[header] = values[index];
        }
      });

      return obj;
    })
    .filter(
      (ad) =>
        ad.video_url &&
        ad.video_url.trim() !== "" &&
        ad.status &&
        ad.status.toLowerCase() === "active"
    );
}

// Parser untuk running text
function parseRunningTextCSV(csvText) {
  const lines = csvText.trim().split("\n");

  if (lines.length < 1) return [];

  if (lines.length === 1) {
    return [{ teks: lines[0].trim() }];
  }

  const headers = lines[0]
    .split(",")
    .map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

  const textColumn =
    headers.find(
      (h) =>
        h.includes("teks") ||
        h.includes("text") ||
        h.includes("isi") ||
        h.includes("running")
    ) || headers[0];

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim());

      if (values.length === 1) {
        return { teks: values[0] };
      }

      const textIndex = headers.indexOf(textColumn);
      const teks =
        textIndex >= 0 && textIndex < values.length
          ? values[textIndex]
          : values.join(" ");

      return { teks };
    })
    .filter((item) => item.teks && item.teks.trim() !== "");
}

// Proses data running text
function processRunningTextData(data) {
  if (!data || data.length === 0) {
    document.getElementById("marqueeText").textContent =
      "Harga emas terkini - Informasi terupdate setiap hari - PantesMall Bandung";
    return;
  }

  const runningTexts = data
    .map((item) => item.teks)
    .filter((teks) => teks && teks.trim() !== "");

  if (runningTexts.length === 0) {
    document.getElementById("marqueeText").textContent =
      "Harga emas terkini - Informasi terupdate setiap hari - PantesMall Bandung";
    return;
  }

  const marqueeContent = runningTexts.join(" 🟡 ");
  const marqueeElement = document.getElementById("marqueeText");
  marqueeElement.textContent = marqueeContent;

  adjustMarqueeSpeed(marqueeContent.length);
}

// Sesuaikan kecepatan marquee
function adjustMarqueeSpeed(textLength) {
  const marqueeElement = document.getElementById("marqueeText");
  const baseDuration = 45;
  const duration = Math.max(baseDuration, textLength / 8);

  marqueeElement.style.animation = "none";

  setTimeout(() => {
    marqueeElement.style.animation = `marquee ${duration}s linear infinite`;
  }, 10);
}

// Parser CSV ke JSON
function parseCSVToJSON(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      let value = values[index] || "";
      if (["harga_jual", "buyback"].includes(header)) {
        value = parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
      }
      obj[header] = value;
    });
    return obj;
  });
}

// Tampilkan semua tabel
function displayAllTables() {
  displayTable("priceTableEmas", appState.tableData.emas, "emas");
  displayTable("priceTableAntam", appState.tableData.antam, "antam");
  displayTable("priceTableArchi", appState.tableData.archi, "archi");
}

// Update tabel dengan pagination
function displayTable(elementId, data, tableType) {
  const tableElement = document.getElementById(elementId);

  if (!data || data.length === 0) {
    tableElement.innerHTML = '<div class="no-data">Data tidak tersedia</div>';
    updatePageIndicator(tableType, 0, 0);
    return;
  }

  const tableState = appState.tablePages[tableType];
  const itemsPerPage = tableState.itemsPerPage;
  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = tableState.currentPage * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, data.length);
  const currentPageData = data.slice(startIndex, endIndex);

  let tableHTML = `
        <table class="price-table">
            <thead>
                <tr>
                    <th>Produk</th>
                    <th>Jual</th>
                    <th>Beli</th>
                </tr>
            </thead>
            <tbody>
    `;

  currentPageData.forEach((item) => {
    tableHTML += `
            <tr>
                <td title="${item.kode || "-"}">${
      formatProductName(item.kode) || "-"
    }</td>
                <td class="highlight">${
                  item.harga_jual ? formatCurrency(item.harga_jual) : "-"
                }</td>
                <td class="highlight">${
                  item.buyback ? formatCurrency(item.buyback) : "-"
                }</td>
            </tr>
        `;
  });

  tableHTML += `
            </tbody>
        </table>
    `;

  tableElement.innerHTML = tableHTML;

  // Update page indicator dan tombol navigasi
  updatePageIndicator(tableType, tableState.currentPage + 1, totalPages);
  updateNavigationButtons(tableType, tableState.currentPage, totalPages);
}

// Update page indicator
function updatePageIndicator(tableType, currentPage, totalPages) {
  const indicator = document.getElementById(
    `pageIndicator${tableType.charAt(0).toUpperCase() + tableType.slice(1)}`
  );
  if (indicator) {
    indicator.textContent = `${currentPage}/${totalPages}`;
  }
}

// Update navigation buttons state
function updateNavigationButtons(tableType, currentPage, totalPages) {
  const prevBtn = document.querySelector(
    `.prev-btn[data-table="${tableType}"]`
  );
  const nextBtn = document.querySelector(
    `.next-btn[data-table="${tableType}"]`
  );

  if (prevBtn) {
    prevBtn.disabled = totalPages <= 1 || currentPage === 0;
  }
  if (nextBtn) {
    nextBtn.disabled = totalPages <= 1 || currentPage === totalPages - 1;
  }
}

// Tampilkan error
function showError() {
  const errorHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Gagal memuat data. Silakan coba lagi.</p>
        </div>
    `;
  document.getElementById("priceTableEmas").innerHTML = errorHTML;
  document.getElementById("priceTableAntam").innerHTML = errorHTML;
  document.getElementById("priceTableArchi").innerHTML = errorHTML;
}

// Reset state ketika halaman di-refresh
window.addEventListener("beforeunload", function () {
  appState.currentVideoIndex = 0;
  appState.videoPlayed = false;
  appState.userInteracted = false;
  appState.autoplayAttempted = false;

  // Clear all intervals
  if (appState.videoRotationInterval) {
    clearInterval(appState.videoRotationInterval);
  }
  Object.values(appState.tableRotationIntervals).forEach((interval) => {
    clearInterval(interval);
  });
});

// Handle visibility change
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    // Pause rotations when tab is not visible
    if (appState.videoRotationInterval)
      clearInterval(appState.videoRotationInterval);
    Object.values(appState.tableRotationIntervals).forEach((interval) => {
      clearInterval(interval);
    });
  } else {
    // Resume rotations when tab becomes visible
    startVideoRotation();
    startTableRotation();
  }
});

// Panggil fungsi saat load dan resize
window.addEventListener('load', adjustLayoutForScreenSize);
window.addEventListener('resize', adjustLayoutForScreenSize);

// YouTube API callback global
window.onYouTubeIframeAPIReady = function () {
  console.log("YouTube API siap digunakan");
};
