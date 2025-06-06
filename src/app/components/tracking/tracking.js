// tracking.js
export const trackEventWithForm = (eventName, additionalData = {}) => {
    // Replace with your Google Form's "formResponse" URL.
    const formUrl =
      "https://docs.google.com/forms/d/e/1FAIpQLSe5Des09Yq8IRnPmTyiIlAjXQPpoauiD1oWfgDHZdogGgwEtw/formResponse";
  
    // Map your data to the form fields using the entry IDs from your pre-filled link.
    const formData = {
      "entry.1568339444": new Date().toISOString(), // Timestamp field
      "entry.1539634642": eventName,                  // Event Name field
      "entry.1014763706": additionalData.panel || "", // Panel field
    };
  
    // Create (or reuse) a hidden iframe to target the form submission.
    let iframe = document.getElementById("hidden_iframe");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.name = "hidden_iframe";
      iframe.id = "hidden_iframe";
      iframe.style.display = "none";
      document.body.appendChild(iframe);
    }
  
    // Create a hidden form element.
    const form = document.createElement("form");
    form.action = formUrl;
    form.method = "POST";
    form.target = "hidden_iframe"; 
    form.style.display = "none";
  
    // Create hidden input elements for each field.
    Object.keys(formData).forEach((key) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = formData[key];
      form.appendChild(input);
    });
  
    // Append the form, submit it, then remove it.
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };
  