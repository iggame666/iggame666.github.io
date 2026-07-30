"use strict";

const CONFIG_URL = "game_list.json";
const PUBLISHED_SITE_URL = new URL("https://dota2tf.github.io/gamelist/");

const elements = {
  gameList: document.querySelector("#game-list"),
  gameCount: document.querySelector("#game-count"),
  configVersion: document.querySelector("#config-version"),
  searchInput: document.querySelector("#game-search"),
  statusMessage: document.querySelector("#status-message"),
  errorPanel: document.querySelector("#error-panel"),
  errorMessage: document.querySelector("#error-message"),
  emptyState: document.querySelector("#empty-state"),
  retryButton: document.querySelector("#retry-button"),
  cardTemplate: document.querySelector("#game-card-template"),
};

let allGames = [];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("配置根节点必须是对象。");
  }

  if (config.schemaVersion !== 1) {
    throw new Error(`不支持的 schemaVersion：${String(config.schemaVersion)}`);
  }

  if (config.code !== 0 || !Array.isArray(config.data?.items)) {
    throw new Error("配置状态异常或 data.items 不是数组。");
  }

  const ids = new Set();
  const packageNames = new Set();

  for (const [index, game] of config.data.items.entries()) {
    const rowName = `第 ${index + 1} 个游戏`;

    if (!isNonEmptyString(game.id) || game.id.trim().length > 64) {
      throw new Error(`${rowName}的 id 无效。`);
    }
    if (!isNonEmptyString(game.packageName)) {
      throw new Error(`${rowName}的 packageName 无效。`);
    }
    if (!isNonEmptyString(game.gameName) || game.gameName.trim().length > 80) {
      throw new Error(`${rowName}的 gameName 无效。`);
    }
    if (typeof game.description === "string" && game.description.length > 500) {
      throw new Error(`${rowName}的 description 超过 500 个字符。`);
    }
    if (ids.has(game.id.trim())) {
      throw new Error(`发现重复 id：${game.id}`);
    }
    if (packageNames.has(game.packageName.trim())) {
      throw new Error(`发现重复 packageName：${game.packageName}`);
    }

    ids.add(game.id.trim());
    packageNames.add(game.packageName.trim());
  }

  return config;
}

function getSafeHttpsUrl(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function getSafeImageUrl(value) {
  if (!isNonEmptyString(value)) {
    return null;
  }

  const trimmedValue = value.trim();
  const hasExplicitScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmedValue);
  const isProtocolRelative = trimmedValue.startsWith("//");

  try {
    const url = new URL(trimmedValue, window.location.href);

    if (!hasExplicitScheme && !isProtocolRelative && url.origin === window.location.origin) {
      return url;
    }

    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function getPreviewImageUrl(value) {
  const safeUrl = getSafeImageUrl(value);
  if (!safeUrl) {
    return null;
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isPublishedAsset =
    safeUrl.origin === PUBLISHED_SITE_URL.origin &&
    safeUrl.pathname.startsWith(PUBLISHED_SITE_URL.pathname);

  if (isLocalHost && isPublishedAsset) {
    return safeUrl.pathname.slice(PUBLISHED_SITE_URL.pathname.length);
  }

  return safeUrl.href;
}

function normalizeSearchText(value) {
  return value.trim().toLocaleLowerCase("zh-Hant");
}

function createGameCard(game, index) {
  const fragment = elements.cardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".game-card");
  const media = fragment.querySelector(".game-card__media");
  const image = fragment.querySelector(".game-card__image");
  const number = fragment.querySelector(".game-card__number");
  const title = fragment.querySelector(".game-card__title");
  const description = fragment.querySelector(".game-card__description");
  const packageName = fragment.querySelector(".game-card__package");
  const action = fragment.querySelector(".game-card__action");

  const gameName = game.gameName.trim();
  const imageUrl = getPreviewImageUrl(game.imageUrl);
  const gameUrl = getSafeHttpsUrl(game.gameUrl);

  card.dataset.gameId = game.id.trim();
  number.textContent = String(index + 1).padStart(2, "0");
  title.textContent = gameName;
  description.textContent = game.description?.trim() || "更多遊戲資訊即將公開。";
  packageName.textContent = game.packageName.trim();
  packageName.title = game.packageName.trim();

  if (imageUrl) {
    image.src = imageUrl;
    image.alt = `${gameName} 遊戲圖示`;
    image.addEventListener(
      "error",
      () => {
        image.classList.add("is-missing");
        media.classList.add("has-missing-image");
        image.alt = "";
      },
      { once: true },
    );
  } else {
    image.classList.add("is-missing");
    media.classList.add("has-missing-image");
  }

  if (gameUrl) {
    action.href = gameUrl.href;
    action.setAttribute("aria-label", `在 Google Play 查看 ${gameName}`);
  } else {
    action.remove();
  }

  return fragment;
}

function renderGames(games) {
  const fragment = document.createDocumentFragment();
  elements.gameList.replaceChildren();

  games.forEach((game) => {
    const originalIndex = allGames.indexOf(game);
    fragment.append(createGameCard(game, originalIndex));
  });

  elements.gameList.append(fragment);
  elements.emptyState.hidden = games.length > 0;
  elements.gameList.hidden = games.length === 0;
  elements.statusMessage.textContent =
    games.length === allGames.length
      ? `共 ${games.length} 款遊戲`
      : `找到 ${games.length} 款遊戲`;
}

function filterGames() {
  const keyword = normalizeSearchText(elements.searchInput.value);

  if (!keyword) {
    renderGames(allGames);
    return;
  }

  const filteredGames = allGames.filter((game) => {
    const searchableText = [
      game.gameName,
      game.description,
      game.packageName,
      game.id,
    ]
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLocaleLowerCase("zh-Hant");

    return searchableText.includes(keyword);
  });

  renderGames(filteredGames);
}

async function loadGameList() {
  elements.errorPanel.hidden = true;
  elements.emptyState.hidden = true;
  elements.gameList.hidden = false;
  elements.gameList.setAttribute("aria-busy", "true");
  elements.searchInput.disabled = true;
  elements.statusMessage.textContent = "正在載入遊戲列表…";

  try {
    const response = await fetch(CONFIG_URL, {
      headers: { Accept: "application/json" },
      cache: "no-cache",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const config = validateConfig(await response.json());
    allGames = config.data.items;

    elements.gameCount.textContent = String(allGames.length).padStart(2, "0");
    elements.configVersion.textContent = config.configVersion || "未標示";
    elements.searchInput.disabled = false;
    renderGames(allGames);
  } catch (error) {
    console.error("载入游戏列表失败：", error);
    elements.gameList.replaceChildren();
    elements.gameList.hidden = true;
    elements.errorPanel.hidden = false;
    elements.statusMessage.textContent = "";
    elements.errorMessage.textContent =
      window.location.protocol === "file:"
        ? "請使用本機 HTTP 伺服器預覽，瀏覽器無法直接從 file:// 讀取 JSON。"
        : `請稍後再試。錯誤資訊：${error.message}`;
  } finally {
    elements.gameList.setAttribute("aria-busy", "false");
  }
}

elements.searchInput.addEventListener("input", filterGames);
elements.retryButton.addEventListener("click", loadGameList);

loadGameList();
