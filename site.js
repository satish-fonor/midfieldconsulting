(function () {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const form = document.getElementById("contact-form");
  if (!form) {
    return;
  }

  const fields = ["name", "email", "company", "message"];

  function setError(field, message) {
    const errorEl = document.getElementById(field + "-error");
    const inputEl = document.getElementById(field);

    if (errorEl) {
      errorEl.textContent = message || "";
    }

    if (!inputEl) {
      return;
    }

    if (message) {
      inputEl.setAttribute("aria-invalid", "true");
    } else {
      inputEl.removeAttribute("aria-invalid");
    }
  }

  function validateEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    const success = document.getElementById("form-success");
    if (success) {
      success.textContent = "";
    }

    const values = {
      name: (document.getElementById("name")?.value || "").trim(),
      email: (document.getElementById("email")?.value || "").trim(),
      company: (document.getElementById("company")?.value || "").trim(),
      message: (document.getElementById("message")?.value || "").trim()
    };

    fields.forEach(function (field) {
      setError(field, "");
    });

    let hasError = false;

    if (!values.name) {
      setError("name", "Name is required.");
      hasError = true;
    }

    if (!values.email) {
      setError("email", "Email is required.");
      hasError = true;
    } else if (!validateEmail(values.email)) {
      setError("email", "Enter a valid email address.");
      hasError = true;
    }

    if (!values.company) {
      setError("company", "Company is required.");
      hasError = true;
    }

    if (!values.message) {
      setError("message", "Message is required.");
      hasError = true;
    }

    if (hasError) {
      return;
    }

    form.reset();
    if (success) {
      success.textContent = "Thanks. We will reach out shortly.";
    }
  });
})();
