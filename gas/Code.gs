// ============================================================
//  의정 랜딩 — Google Apps Script (시트 기록 + 메일 알림 + 메타 전환 API)
//  ※ 이 파일은 붙여넣기용 참고본입니다. 실제 동작 코드는 Apps Script 편집기에 있습니다.
//    수정 후 반드시 "배포 → 배포 관리 → 새 버전"으로 다시 배포해야 반영됩니다.
// ============================================================

// ── 설정 ──────────────────────────────────────────────
const SPREADSHEET_ID = '15F84kiiyIFbv2-aVaUpdPJ_8mdHD7zf0PkPuWB1FEs8';
const NOTIFY_EMAIL = 'pioneeret2@gmail.com';
const DEFAULT_REF = '직접방문';
const SHEET_NAME = '문의';

// ── 메타 전환 API 설정 ────────────────────────────────
const META_PIXEL_ID = '1322068562837541';
const META_ACCESS_TOKEN =
  'EAAjGi5v717EBR9lhg7HbaNVxlLqZBR3JYzc60uwYN6MFXky6LIxjqxVGuWi4VL9gITCaY2fRRutetXrHr675ZCCEZBjZAm6xsNdfyAUOAuHk5CIyJZBJ4KiM2ufIATwyAZAbbybxw107ZB10JrOxKEE7QerpE0E6rIpH8wS9yTCWdxZBDOLUJsQnFsBZAZC0Vb7QZDZD';
const META_API_VERSION = 'v21.0';
// 테스트 중에만 사용: Events Manager → 테스트 이벤트 탭의 코드 (예: 'TEST12345').
// 실제 운영 시에는 반드시 '' (빈 문자열)로 두세요.
const META_TEST_EVENT_CODE = '';
const META_DEFAULT_EVENT_NAME = 'Lead';

// ★ 시트 컬럼 고정 순서 (이 순서대로 정렬, 목록에 없는 키는 뒤에 자동 추가)
const HEADERS = ['접수시각', '이름', '연락처', '동의', '채무금액', '월소득', '주요상황', 'ref'];

// 메타 전송에만 쓰고 시트에는 기록하지 않을 보조 필드
const META_FIELDS = ['_eventName', '_eventId', '_eventSourceUrl', '_fbp', '_fbc', '_ua'];

// ── POST 수신 ─────────────────────────────────────────
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = parseBody_(e);
    if (!data.ref) data.ref = DEFAULT_REF;

    const formType = String(data.form || 'contact'); // 메일 표시용으로만 사용
    delete data.form;                                 // '구분' 컬럼 미사용

    // 메타 보조 필드 분리 (시트 기록에서 제외)
    const meta = {};
    META_FIELDS.forEach(function (k) {
      if (data[k] !== undefined) { meta[k] = data[k]; delete data[k]; }
    });

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    const row = Object.assign({ 접수시각: nowKst_() }, data); // 구분 제거
    appendByHeader_(sheet, row);

    sendNotify_(formType, row);

    // 메타 전환 API 전송 (실패해도 접수는 정상 처리)
    try {
      sendMetaCapi_(row, meta);
    } catch (capiErr) {
      console.error('메타 CAPI 전송 실패: ' + capiErr);
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, msg: 'GAS web app is running' });
}

// ── 메타 전환 API 전송 ────────────────────────────────
function sendMetaCapi_(row, meta) {
  if (!META_ACCESS_TOKEN || !META_PIXEL_ID) return;

  // ★ 메타 유입(?ref=meta)만 전환 전송. 그 외(네이버·블로그·직접방문 등)는 시트만 기록하고 메타엔 안 보냄.
  if (String(row['ref'] || '').toLowerCase() !== 'meta') return;

  const userData = {};
  const ph = normalizePhone_(row['연락처']);
  if (ph) userData.ph = [sha256_(ph)];
  if (row['이름']) userData.fn = [sha256_(String(row['이름']).trim().toLowerCase())];
  if (meta._fbp) userData.fbp = meta._fbp;
  if (meta._fbc) userData.fbc = meta._fbc;
  if (meta._ua) userData.client_user_agent = meta._ua;

  // 매칭 가능한 고객정보가 전혀 없으면 전송 생략(메타가 거부함)
  if (!userData.ph && !userData.fn && !userData.fbp && !userData.fbc) return;

  const event = {
    event_name: meta._eventName || META_DEFAULT_EVENT_NAME,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: userData,
  };
  if (meta._eventId) event.event_id = meta._eventId; // 브라우저 픽셀과 중복제거
  if (meta._eventSourceUrl) event.event_source_url = meta._eventSourceUrl;

  const payload = { data: [event] };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;

  const url =
    'https://graph.facebook.com/' + META_API_VERSION + '/' +
    META_PIXEL_ID + '/events?access_token=' + encodeURIComponent(META_ACCESS_TOKEN);

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  console.log('메타 CAPI 응답: ' + res.getResponseCode() + ' ' + res.getContentText());
}

// 전화번호 → E.164(국가코드 82) 정규화. 숫자만 추출 후 선행 0 → 82
function normalizePhone_(raw) {
  if (!raw) return '';
  let d = String(raw).replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.indexOf('82') === 0) return d;        // 이미 국가코드 포함
  if (d.charAt(0) === '0') d = d.slice(1);    // 선행 0 제거
  return '82' + d;
}

// SHA-256 → 소문자 16진수
function sha256_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); })
    .join('');
}

// ── 알림 메일 ─────────────────────────────────────────
function sendNotify_(formType, row) {
  try {
    const rows = Object.keys(row).map(function (k) {
      return '<tr><td style="background:#f5f5f5;"><b>' + escapeHtml_(k) + '</b></td>' +
        '<td>' + escapeHtml_(row[k]) + '</td></tr>';
    }).join('');
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: '의정 랜딩 문의',
      htmlBody:
        '<h3>새 접수가 등록되었습니다</h3>' +
        '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">' + rows + '</table>'
    });
  } catch (mailErr) {
    console.error('메일 발송 실패: ' + mailErr);
  }
}

// ── JSON 응답 헬퍼 ────────────────────────────────────
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 본문 파싱 ─────────────────────────────────────────
function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (_) {}
  }
  if (e && e.parameter) return e.parameter;
  return {};
}

// ── 고정 순서(HEADERS) 우선으로 한 줄 추가 ────────────
function appendByHeader_(sheet, obj) {
  let headers = [];
  if (sheet.getLastColumn() > 0) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].filter(String);
  }
  // 1) 고정 순서 먼저 보장
  HEADERS.forEach(function (h) { if (headers.indexOf(h) === -1) headers.push(h); });
  // 2) 그 외 새 키(예: 진단결과·예상월변제액 등)는 뒤에 자동 추가
  Object.keys(obj).forEach(function (k) { if (headers.indexOf(k) === -1) headers.push(k); });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);

  const rowValues = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(rowValues);
}

// ── 한국시간 ──────────────────────────────────────────
function nowKst_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

// ── HTML 이스케이프 ───────────────────────────────────
function escapeHtml_(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
