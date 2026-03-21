(function () {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const pathname = window.location.pathname.replace(/\/+$/, "");
  const isThankYouPage =
    pathname === "/thank-you" ||
    pathname === "/thank-you.html" ||
    pathname.endsWith("/thank-you/index.html");

  if (!isThankYouPage) {
    return;
  }

  const url = new URL(window.location.href);
  // Only treat Calendly return visits with the explicit redirect marker as conversions.
  const shouldTrackLead = url.searchParams.get("lead") === "1";

  if (!shouldTrackLead || typeof window.fbq !== "function") {
    return;
  }

  window.fbq("track", "Lead");
  url.searchParams.delete("lead");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
})();
