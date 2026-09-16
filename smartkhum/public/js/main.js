// SmartKhum — report form logic (Stage 1: User)
// Handles voice input (Web Speech API), photo capture, GPS location,
// and submits the issue to the backend for AI classification.

(function () {
  const form = document.getElementById('report-form');
  const descriptionEl = document.getElementById('description');
  const submitBtn = document.getElementById('submit-btn');
  const toast = document.getElementById('toast');

  let capturedPhoto = null; // base64 string
  let capturedLocation = null; // { lat, lng }
  let inputMethod = 'text';

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('error', !!isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  // ---------- Voice input (Web Speech API) ----------
  const btnVoice = document.getElementById('btn-voice');
  const voiceLabel = document.getElementById('voice-label');
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let listening = false;

  if (SpeechRecognition) {
    recognizer = new SpeechRecognition();
    recognizer.lang = 'km-KH'; // Khmer; falls back gracefully in unsupported browsers
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    recognizer.onresult = function (event) {
      const transcript = event.results[0][0].transcript;
      descriptionEl.value = (descriptionEl.value ? descriptionEl.value + ' ' : '') + transcript;
      inputMethod = 'voice';
    };
    recognizer.onerror = function () {
      showToast('មិនអាចស្តាប់សំឡេងបានទេ សូមព្យាយាមម្តងទៀត ឬវាយបញ្ចូលដោយដៃ', true);
      setListening(false);
    };
    recognizer.onend = function () { setListening(false); };
  }

  function setListening(state) {
    listening = state;
    btnVoice.classList.toggle('active', state);
    voiceLabel.textContent = state ? 'កំពុងស្តាប់...' : 'និយាយសំឡេង';
  }

  btnVoice.addEventListener('click', function () {
    if (!recognizer) {
      showToast('ឧបករណ៍នេះមិនគាំទ្រការស្តាប់សំឡេងទេ សូមវាយបញ្ចូលដោយដៃ', true);
      return;
    }
    if (listening) {
      recognizer.stop();
    } else {
      setListening(true);
      recognizer.start();
    }
  });

  // ---------- Photo capture ----------
  const btnPhoto = document.getElementById('btn-photo');
  const photoInput = document.getElementById('photo-input');
  const photoPreview = document.getElementById('photo-preview');

  btnPhoto.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', function () {
    const file = photoInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      // downscale via canvas to keep payload small
      const img = new Image();
      img.onload = function () {
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        capturedPhoto = canvas.toDataURL('image/jpeg', 0.7);
        photoPreview.src = capturedPhoto;
        photoPreview.style.display = 'block';
        btnPhoto.classList.add('active');
        inputMethod = 'photo';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  // ---------- GPS ----------
  const btnGps = document.getElementById('btn-gps');
  const gpsLabel = document.getElementById('gps-label');

  btnGps.addEventListener('click', function () {
    if (!navigator.geolocation) {
      showToast('ឧបករណ៍នេះមិនគាំទ្រ GPS ទេ', true);
      return;
    }
    gpsLabel.textContent = 'កំពុងស្វែងរក...';
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        capturedLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        gpsLabel.textContent = 'បានកំណត់ទីតាំង ✓';
        btnGps.classList.add('active');
      },
      function () {
        gpsLabel.textContent = 'ទីតាំង GPS';
        showToast('មិនអាចទទួលបានទីតាំងទេ', true);
      },
      { timeout: 10000 }
    );
  });

  // ---------- Submit ----------
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const description = descriptionEl.value.trim();
    if (!description) {
      showToast('សូមបំពេញការពិពណ៌នាបញ្ហា', true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '📡 កំពុងបញ្ជូន...';

    const payload = {
      description: description,
      reporter_name: document.getElementById('reporter_name').value.trim() || null,
      village: document.getElementById('village').value.trim() || null,
      photo_data: capturedPhoto,
      latitude: capturedLocation ? capturedLocation.lat : null,
      longitude: capturedLocation ? capturedLocation.lng : null,
      input_method: inputMethod
    };

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'មានបញ្ហា');

      showToast(`✅ បានផ្ញើ! AI បានចាត់ថ្នាក់ជា "${data.category}" — អាទិភាព ${data.priority}`);
      form.reset();
      photoPreview.style.display = 'none';
      capturedPhoto = null;
      capturedLocation = null;
      inputMethod = 'text';
      gpsLabel.textContent = 'ទីតាំង GPS';
      btnGps.classList.remove('active');
      btnPhoto.classList.remove('active');
    } catch (err) {
      showToast('❌ ' + err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '📡 បញ្ជូនទៅ AI Server';
    }
  });
})();
