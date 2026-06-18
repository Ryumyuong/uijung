/* ============================================================
   의정종합법률사무소 — 인터랙션
   ============================================================ */

/* ---------- 구글 스프레드시트(GAS) 전송 ---------- */
const GAS_URL =
  'https://script.google.com/macros/s/AKfycbx9Qx_5jVJZWzz-BYcZFFiw0ySkPvckr9oYH8XxQK0DyFebTrJul9bP0vw7hDl00QD9/exec';

// 유입경로(ref): URL의 ?ref= 값이 있으면 우선 사용, 없으면 아래 기본값 사용
const REF = ''; // ← 여기에 기본 유입경로를 직접 설정하세요 (예: 'naver', 'blog', 'meta')

function getRef() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('ref');
    return (fromUrl || REF || '').trim();
  } catch (_) {
    return REF;
  }
}

function sendToSheet(form, data) {
  // text/plain 으로 보내 CORS 프리플라이트 회피 (제출만, 응답은 읽지 않음)
  return fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ form, ref: getRef(), ...data }),
  }).catch((err) => console.error('sheet 전송 실패:', err));
}

/* ---------- 개인정보처리방침 팝업 ---------- */
(() => {
  const modal = document.querySelector('[data-privacy-modal]');
  if (!modal) return;
  const open = () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  };
  document.querySelectorAll('[data-privacy-open]').forEach((btn) =>
    btn.addEventListener('click', open),
  );
  modal.querySelectorAll('[data-privacy-close]').forEach((btn) =>
    btn.addEventListener('click', close),
  );
  // 배경 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  // ESC로 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
})();

/* ---------- 모바일 햄버거 메뉴 ---------- */
(() => {
  const toggle = document.querySelector('[data-menu-toggle]');
  const panel = document.querySelector('[data-menu-panel]');
  if (!toggle || !panel) return;
  const setOpen = (open) => {
    panel.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  };
  toggle.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
  // 링크 클릭 시 닫기
  panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  // 데스크탑으로 넓어지면 패널 닫기
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
})();

/* ---------- 헤더 스크롤 그림자 ---------- */
const header = document.querySelector('[data-header]');
if (header) {
  const onScroll = () => header.classList.toggle('header-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- FAQ: 한 번에 하나만 열림 ---------- */
const faqItems = document.querySelectorAll('.faq-item');
faqItems.forEach((d) => {
  d.addEventListener('toggle', () => {
    if (d.open) {
      faqItems.forEach((o) => {
        if (o !== d) o.open = false;
      });
    }
  });
});

/* ============================================================
   변제금 진단 4-step 위저드
   계산 로직: dongseong 방식
   - incomeMonthly = max(income - livingCost, 30) [만원]
   - 36개월 안에 전액 변제 가능 → 분기 B (회생 부적합)
   - 그 외 → max(incomeMonthly, ceil(debt × 0.15 / 36))으로 월 변제액 산정
   ============================================================ */
(() => {
  const root = document.querySelector('[data-diag-steps]');
  if (!root) return;

  const stepLabel = document.getElementById('diagStepLabel');
  const progress = document.getElementById('diagProgress');
  const stepEls = [...root.querySelectorAll('[data-diag-step]')];
  const resultEl = root.querySelector('[data-diag-result]');
  const resultBody = root.querySelector('[data-diag-result-body]');
  const finalForm = root.querySelector('[data-diag-final]');
  const TOTAL = 4;
  const DEFAULT_LIVING_COST = 215; // 2인 기준 (만원)

  const state = { step: 1, debt: null, income: null, situations: [] };

  const setProgress = (n) => {
    if (stepLabel) stepLabel.textContent = `${n}/${TOTAL}단계`;
    if (progress) progress.style.width = `${(n / TOTAL) * 100}%`;
  };

  const showStep = (n) => {
    state.step = n;
    stepEls.forEach((el) => {
      el.hidden = el.dataset.diagStep !== String(n);
    });
    if (resultEl) resultEl.hidden = true;
    setProgress(n);
  };

  const calculate = (debt, income, livingCost) => {
    const incomeMonthly = Math.max(income - livingCost, 30);
    if (incomeMonthly * 36 >= debt) return { branch: 'B' };
    const debtFloorMonthly = Math.ceil((debt * 0.15) / 36);
    const monthlyPayment = Math.max(incomeMonthly, debtFloorMonthly);
    return {
      branch: 'A',
      monthlyPayment,
      totalPayment: monthlyPayment * 36,
      originalDebt: debt,
    };
  };

  const fmt = (n) => n.toLocaleString('ko-KR');

  const showResult = () => {
    stepEls.forEach((el) => {
      el.hidden = true;
    });
    setProgress(TOTAL);
    if (!resultEl || !resultBody) return;
    resultEl.hidden = false;

    const r = calculate(state.debt, state.income, DEFAULT_LIVING_COST);

    if (r.branch === 'B') {
      resultBody.innerHTML = `
        <div class="rounded-[14px] bg-[#fff8e8] p-6">
          <p class="mb-2 text-[16px] font-bold text-navy-800">회생보다 더 적합한 방향이 있습니다</p>
          <p class="text-[14px] leading-[1.7] text-ink-soft">
            현재 채무 규모 대비 소득이 충분합니다.<br/>
            개인회생 외 다른 해결 방안을 안내해드립니다.
          </p>
        </div>
        <p class="mt-3 text-xs text-ink-mute">*전문 상담을 통해 더 적합한 해결 방향을 안내해드립니다</p>
      `;
    } else {
      const reduction = Math.round(((r.originalDebt - r.totalPayment) / r.originalDebt) * 100);
      resultBody.innerHTML = `
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-[14px] bg-[#f6f8fb] p-5 text-center">
            <div class="mb-1 text-[12px] font-semibold text-ink-soft">예상 월 변제액</div>
            <div class="text-[26px] font-extrabold text-navy-800">${fmt(r.monthlyPayment)}<span class="text-[14px] font-bold">만원</span></div>
          </div>
          <div class="rounded-[14px] bg-[#0B233B] p-5 text-center text-white">
            <div class="mb-1 text-[12px] font-semibold text-[#9fb6dc]">36개월 총 변제액</div>
            <div class="text-[26px] font-extrabold text-[#E6B54C]">${fmt(r.totalPayment)}<span class="text-[14px] font-bold">만원</span></div>
          </div>
        </div>
        <p class="mt-3 text-[14px] leading-[1.7] text-ink-soft">
          원 채무 <b class="font-extrabold text-navy-800">${fmt(r.originalDebt)}만원</b>을 36개월 동안 분할 변제 (약 <b class="text-[#0359EE]">${reduction}% 감면</b>)
        </p>
        <p class="mt-2 text-xs text-ink-mute">*예상 금액이며, 정확한 금액은 전문 상담을 통해 확인하세요</p>
      `;
    }
  };

  // 옵션 선택 (Step 1, 2) — 클릭 시 값 저장 + 0.2초 후 자동으로 다음 단계
  root.querySelectorAll('[data-diag-opts]').forEach((group) => {
    const key = group.dataset.diagKey;
    group.querySelectorAll('[data-diag-opt]').forEach((opt) => {
      opt.addEventListener('click', () => {
        group.querySelectorAll('[data-diag-opt]').forEach((o) => o.classList.remove('is-on'));
        opt.classList.add('is-on');
        if (key) state[key] = parseInt(opt.dataset.value, 10);
        // Step 1, 2는 옵션 선택 시 자동 다음 단계
        if (state.step < 3) {
          setTimeout(() => showStep(state.step + 1), 200);
        }
      });
    });
  });

  // 이전 단계
  root.querySelectorAll('[data-diag-prev]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.step > 1) showStep(state.step - 1);
    });
  });

  // 다음 단계 (Step 3 → 4)
  root.querySelectorAll('[data-diag-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.situations = [...root.querySelectorAll('[data-diag-situation]:checked')].map(
        (c) => c.value
      );
      showStep(4);
    });
  });

  // 최종 제출 (Step 4) → 계산 + 결과 표시
  if (finalForm) {
    finalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = finalForm.name.value.trim();
      const phone = finalForm.phone.value.trim();
      const agree = finalForm.agree.checked;
      if (!name || !phone) {
        alert('이름과 연락처를 입력해 주세요.');
        return;
      }
      if (!agree) {
        alert('개인정보 수집 및 이용에 동의해 주세요.');
        return;
      }
      sendToSheet('진단신청', {
        이름: name,
        연락처: phone,
        채무금액: state.debt,
        월소득: state.income,
        주요상황: state.situations.join(', '),
        동의: 'Y',
      });
      showResult();
    });
  }

  // 처음부터 다시
  const restartBtn = root.querySelector('[data-diag-restart]');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      state.debt = null;
      state.income = null;
      state.situations = [];
      root.querySelectorAll('[data-diag-opt].is-on').forEach((o) => o.classList.remove('is-on'));
      root.querySelectorAll('[data-diag-situation]:checked').forEach((c) => (c.checked = false));
      if (finalForm) finalForm.reset();
      showStep(1);
    });
  }

  showStep(1);
})();

/* ---------- 상단 이동(TOP) ---------- */
const quickTop = document.getElementById('quickTop');
if (quickTop) {
  quickTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ---------- 상담 신청 폼 (중간·하단 동일 처리) ---------- */
document.querySelectorAll('#contactForm, #contactFormMid').forEach((contactForm) => {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = contactForm.name.value.trim();
    const phone = contactForm.phone.value.trim();
    const agree = contactForm.agree.checked;
    if (!name || !phone) {
      alert('이름과 연락처를 입력해 주세요.');
      return;
    }
    if (!agree) {
      alert('개인정보 수집 및 이용에 동의해 주세요.');
      return;
    }
    sendToSheet('상담신청', {
      이름: name,
      연락처: phone,
      동의: 'Y',
    });
    alert('상담 신청이 접수되었습니다.\n담당자가 순차적으로 연락드리겠습니다.');
    contactForm.reset();
  });
});

/* ---------- 하단 고정 진단 바 (PC + 모바일) ---------- */
[
  ['quickDiagBtn', 'quickDiagForm'],
  ['quickDiagBtnM', 'quickDiagFormM'],
].forEach(([btnId, formId]) => {
  const quickDiagBtn = document.getElementById(btnId);
  const quickDiagForm = document.getElementById(formId);
  if (!quickDiagBtn || !quickDiagForm) return;
  const q = (n) => quickDiagForm.querySelector(`[name="${n}"]`);
  quickDiagBtn.addEventListener('click', (e) => {
    // 스크롤(앵커 이동) 없이 항상 그 자리에서 접수 처리
    e.preventDefault();
    e.stopImmediatePropagation();
    const name = (q('이름')?.value || '').trim();
    const phone = (q('연락처')?.value || '').trim();
    const agree = q('동의')?.checked;
    if (!name || !phone) {
      alert('이름과 연락처를 입력해 주세요.');
      return;
    }
    if (!agree) {
      alert('개인정보 수집 및 활용에 동의해 주세요.');
      return;
    }
    // 검증 통과 시: 시트로 전송 + 확인 안내 + 입력값 초기화
    sendToSheet('하단진단', {
      이름: name,
      연락처: phone,
      동의: 'Y',
    });
    alert('상담 신청이 접수되었습니다.\n담당자가 순차적으로 연락드리겠습니다.');
    if (typeof quickDiagForm.reset === 'function') {
      quickDiagForm.reset();
    } else {
      [q('이름'), q('연락처')].forEach((el) => el && (el.value = ''));
      const c = q('동의');
      if (c) c.checked = false;
    }
  });
});

/* ---------- 스크롤 등장 애니메이션 (아래→위, 같은 행은 왼→오 순차) ---------- */
(() => {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const STAGGER = 110; // ms
  const targets = [];

  // 그리드/플렉스/리스트처럼 여러 항목이 한 줄에 늘어선 컨테이너
  const isRow = (el) => {
    if (el.children.length < 2) return false;
    if (el.tagName === 'UL' || el.tagName === 'OL') return true;
    const d = getComputedStyle(el).display;
    return d === 'flex' || d === 'inline-flex' || d === 'grid' || d === 'inline-grid';
  };
  // 애니메이션에서 제외할 요소 (장식/절대배치/투명도 지정 등)
  const skip = (el) =>
    el.hasAttribute('aria-hidden') ||
    [...el.classList].some(
      (c) =>
        c.startsWith('opacity-') ||
        c.includes('translate') ||
        c.includes('absolute') ||
        c === 'fixed' ||
        c.startsWith('hero-'),
    );

  document.querySelectorAll('main > section, main > div').forEach((sec) => {
    if (sec.querySelector('#hero-title')) return; // 히어로 섹션 제외
    const inner = sec.querySelector(':scope > div') || sec;
    [...inner.children].forEach((child) => {
      if (skip(child)) return;
      if (isRow(child)) {
        [...child.children].forEach((g) => {
          if (!skip(g)) targets.push(g);
        });
      } else {
        targets.push(child);
      }
    });
  });

  targets.forEach((el) => el.classList.add('reveal'));

  // 같은 부모 안에서의 순서(DOM 순서 = 왼→오 / 위→아래)대로 딜레이 부여
  targets.forEach((el) => {
    let idx = 0;
    let p = el.previousElementSibling;
    while (p) {
      if (p.classList.contains('reveal')) idx++;
      p = p.previousElementSibling;
    }
    el.style.transitionDelay = `${Math.min(idx, 12) * STAGGER}ms`;
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
  );

  targets.forEach((el) => io.observe(el));
})();

/* ---------- 숫자 카운트업 (LIVE 현황) ---------- */
(() => {
  const targets = document.querySelectorAll('[data-count]');
  if (!targets.length || !('IntersectionObserver' in window)) return;
  const animate = (el) => {
    const end = parseInt(el.dataset.count, 10) || 0;
    const dur = 1100;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.floor(end * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          animate(en.target);
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  targets.forEach((t) => io.observe(t));
})();

/* ============================================================
   캐러셀 (data-carousel)
   data-mode="center" : 가운데 카드 강조 + 무한 루프
   data-mode="cards"  : 여러 카드 슬라이드
   ============================================================ */
document.querySelectorAll('[data-carousel]').forEach((root) => {
  const viewport = root.querySelector('[data-carousel-viewport]');
  const track = root.querySelector('[data-carousel-track]');
  const prev = root.querySelector('[data-carousel-prev]');
  const next = root.querySelector('[data-carousel-next]');
  const dotsWrap = root.querySelector('[data-carousel-dots]');
  const mode = root.dataset.mode || 'cards';
  const isLooping = mode === 'center';

  const originalCount = track.children.length;
  if (!originalCount) return;

  if (isLooping) {
    const originals = [...track.children];
    originals.forEach((c) => {
      const cl = c.cloneNode(true);
      cl.classList.add('is-clone');
      track.appendChild(cl);
    });
    originals
      .slice()
      .reverse()
      .forEach((c) => {
        const cl = c.cloneNode(true);
        cl.classList.add('is-clone');
        track.insertBefore(cl, track.firstChild);
      });
  }

  const cards = [...track.children];
  let index = isLooping
    ? originalCount + Math.floor((originalCount - 1) / 2)
    : mode === 'center'
      ? Math.floor((originalCount - 1) / 2)
      : 0;
  let isAnimating = false;

  const getGap = () =>
    parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') || 0;
  // 카드에 scale 변형이 걸려있어도 레이아웃 기준 너비로 step 계산
  const getStep = () => cards[0].offsetWidth + getGap();
  const visibleCount = () => {
    const step = getStep();
    return Math.max(1, Math.floor((viewport.getBoundingClientRect().width + getGap()) / step));
  };
  const maxIndex = () => {
    if (mode === 'center') return cards.length - 1;
    return Math.max(0, cards.length - visibleCount());
  };

  const buildDots = () => {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    const count = isLooping ? originalCount : maxIndex() + 1;
    for (let i = 0; i < count; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `${i + 1}번째`);
      b.addEventListener('click', () => {
        index = isLooping ? originalCount + i : i;
        render();
      });
      dotsWrap.appendChild(b);
    }
  };

  const applyTransform = () => {
    const step = getStep();
    let x;
    if (mode === 'center') {
      const vpW = viewport.getBoundingClientRect().width;
      const cardW = cards[0].offsetWidth;
      x = -(index * step) + (vpW / 2 - cardW / 2);
      cards.forEach((c, i) => {
        c.classList.toggle('is-center', i === index);
        c.classList.toggle('is-near', i === index - 1 || i === index + 1);
        // 가운데 카드는 드래그(grab), 양옆 흐린 카드는 클릭(pointer) 커서
        c.style.cursor = i === index ? 'grab' : 'pointer';
      });
    } else {
      x = -(index * step);
    }
    track.style.transform = `translateX(${x}px)`;
  };

  const render = () => {
    if (!isLooping) index = Math.max(0, Math.min(index, maxIndex()));
    applyTransform();
    if (dotsWrap) {
      const activeDot = isLooping
        ? (((index - originalCount) % originalCount) + originalCount) % originalCount
        : index;
      [...dotsWrap.children].forEach((d, i) => d.classList.toggle('is-on', i === activeDot));
    }
  };

  if (isLooping) {
    track.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'transform') return;
      isAnimating = false;
      if (index >= 2 * originalCount) index -= originalCount;
      else if (index < originalCount) index += originalCount;
      else return;
      track.style.transition = 'none';
      cards.forEach((c) => {
        c.style.transition = 'none';
      });
      applyTransform();
      void track.offsetHeight;
      requestAnimationFrame(() => {
        track.style.transition = '';
        cards.forEach((c) => {
          c.style.transition = '';
        });
      });
    });
  }

  prev &&
    prev.addEventListener('click', () => {
      if (isAnimating) return;
      isAnimating = isLooping;
      index--;
      if (!isLooping && index < 0) index = maxIndex();
      render();
    });
  next &&
    next.addEventListener('click', () => {
      if (isAnimating) return;
      isAnimating = isLooping;
      index++;
      if (!isLooping && index > maxIndex()) index = 0;
      render();
    });

  // center 모드: 양옆 흐린 카드를 클릭하면 그 카드가 가운데로
  // (드래그 후의 클릭은 viewport의 capture 핸들러가 막아준다)
  if (mode === 'center') {
    cards.forEach((card, i) => {
      card.addEventListener('click', () => {
        if (isAnimating || i === index) return;
        isAnimating = isLooping;
        index = i;
        render();
      });
    });
  }

  // 자동 슬라이드 (data-autoplay="ms")
  let autoStart = () => {};
  let autoStop = () => {};
  const autoplayMs = parseInt(root.dataset.autoplay || '0', 10);
  if (autoplayMs > 0) {
    let timer = null;
    const advance = () => {
      if (isAnimating) return;
      isAnimating = isLooping;
      index++;
      if (!isLooping && index > maxIndex()) index = 0;
      render();
    };
    autoStart = () => {
      if (!timer) timer = setInterval(advance, autoplayMs);
    };
    autoStop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    root.addEventListener('mouseenter', autoStop);
    root.addEventListener('mouseleave', autoStart);
    autoStart();
  }

  // 드래그(스와이프)는 카드 클릭과 충돌하여 제거함. 이동은 prev/next·도트·카드 클릭으로.
  track.addEventListener('dragstart', (ev) => ev.preventDefault());

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      buildDots();
      render();
    }, 150);
  });

  buildDots();
  render();
  window.addEventListener('load', () => {
    buildDots();
    render();
  });
});

/* ---------- CTA 링크 — 핵심 패널을 화면 중앙으로 스크롤 ---------- */
(() => {
  // 해시 → 실제로 중앙에 둘 요소 id
  const CENTER_TARGET = {
    '#diagnosis': 'contactForm', // 모든 CTA → 최하단 문의 폼으로 통일
    '#contact': 'contactForm', // 간편 상담 신청 폼(최하단)
    '#contact-mid': 'contactFormMid', // 히어로 간편상담 → 바로 아래 중간 문의 폼
  };
  document.querySelectorAll('a[href]').forEach((link) => {
    const hash = link.getAttribute('href');
    const targetId = CENTER_TARGET[hash];
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      // 모바일: 고정 헤더(80px) 아래로 상단을 맞춰 약간 위에 포커스
      if (window.matchMedia('(max-width: 900px)').matches) {
        const OFFSET = 96; // 헤더 80px + 여백
        const y = target.getBoundingClientRect().top + window.pageYOffset - OFFSET;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      history.replaceState(null, '', hash);
    });
  });
})();

/* ---------- 세로 자동 순환 (망설이는 이유 / FAQ) ----------
   3개씩 보여주고 일정 시간마다 한 칸씩 위로 회전.
   data-expandable: details 펼침 시 순환 중지 + 뷰포트 확장 */
function initVRotator(wrap) {
  const track = wrap.querySelector('[data-rotator-track]');
  if (!track) return;
  const VISIBLE = parseInt(wrap.dataset.visible || '3', 10);
  const INTERVAL = parseInt(wrap.dataset.interval || '2600', 10);
  const DURATION = 600;
  const expandable = wrap.hasAttribute('data-expandable');
  // 다음 항목을 살짝 노출 + 하단 페이드로 '넘어가는 중'임을 표시
  const peekOn = wrap.hasAttribute('data-peek');
  if (track.children.length <= VISIBLE) return;

  const gap = () => parseFloat(getComputedStyle(track).rowGap) || 0;
  const sizeViewport = () => {
    const h = track.children[0].getBoundingClientRect().height;
    const peek = peekOn ? gap() + h * 0.72 : 0;
    wrap.style.height = h * VISIBLE + gap() * (VISIBLE - 1) + peek + 'px';
    if (peekOn) wrap.classList.add('is-peeking');
    return h + gap();
  };
  sizeViewport();

  let timer = null;
  let paused = false;

  const tick = () => {
    if (paused) return;
    const step = sizeViewport();
    track.style.transition = `transform ${DURATION}ms ease`;
    track.style.transform = `translateY(-${step}px)`;
    const onEnd = (e) => {
      if (e.target !== track || e.propertyName !== 'transform') return;
      track.removeEventListener('transitionend', onEnd);
      track.style.transition = 'none';
      track.style.transform = 'translateY(0)';
      track.appendChild(track.children[0]); // 맨 위 항목을 맨 아래로
      void track.offsetHeight; // 리플로우 강제
    };
    track.addEventListener('transitionend', onEnd);
  };

  const start = () => {
    if (!timer && !paused) timer = setInterval(tick, INTERVAL);
  };
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) start();
  wrap.addEventListener('mouseenter', stop);
  wrap.addEventListener('mouseleave', () => {
    if (!paused) start();
  });

  if (expandable) {
    // toggle 은 버블링되지 않으므로 capture 로 수신
    track.addEventListener(
      'toggle',
      () => {
        if (track.querySelector('details[open]')) {
          // 펼쳐도 보이는 3개만 유지 — 열린 항목 포함한 현재 상단 3개 높이로 확장
          paused = true;
          stop();
          if (peekOn) wrap.classList.remove('is-peeking');
          track.style.transition = 'none';
          track.style.transform = 'translateY(0)';
          let h = 0;
          const n = Math.min(VISIBLE, track.children.length);
          for (let i = 0; i < n; i++) {
            h += track.children[i].getBoundingClientRect().height;
          }
          wrap.style.height = h + gap() * (n - 1) + 'px';
        } else {
          sizeViewport();
          paused = false;
          start();
        }
      },
      true,
    );
  }

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!paused) sizeViewport();
    }, 150);
  });
}

document.querySelectorAll('[data-vrotator]').forEach(initVRotator);

/* ============================================================
   마퀴 캐러셀 (data-marquee)
   무한 루프 + 3초마다 1카드씩 자동 이동 + 마우스/터치 드래그
   ============================================================ */
document.querySelectorAll('[data-marquee]').forEach((root) => {
  const viewport = root.querySelector('[data-carousel-viewport]');
  const track = root.querySelector('[data-carousel-track]');
  if (!viewport || !track) return;

  const originals = [...track.children];
  const N = originals.length;
  if (!N) return;

  const EASE = 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)';
  const INTERVAL = 3000;

  // 앞뒤로 원본 세트 복제 (양방향 무한 루프)
  originals.forEach((c) => track.appendChild(c.cloneNode(true)));
  originals
    .slice()
    .reverse()
    .forEach((c) => track.insertBefore(c.cloneNode(true), track.firstChild));

  const cards = [...track.children];

  const gapOf = () =>
    parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0') || 0;
  let step = cards[0].getBoundingClientRect().width + gapOf();

  let index = N; // 가운데(원본) 세트 시작
  let curX = -index * step;
  let dragging = false;
  let startX = 0;
  let startCurX = 0;
  let moved = 0;

  const setX = (x, animate) => {
    track.style.transition = animate ? EASE : 'none';
    track.style.transform = `translateX(${x}px)`;
    curX = x;
  };
  const goto = (i, animate = true) => {
    index = i;
    setX(-index * step, animate);
  };

  // 끝 세트에 닿으면 보이지 않게 가운데로 리셋
  track.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'transform') return;
    if (index >= 2 * N) {
      index -= N;
      setX(-index * step, false);
    } else if (index < N) {
      index += N;
      setX(-index * step, false);
    }
  });

  let timer = null;
  const startAuto = () => {
    stopAuto();
    timer = setInterval(() => {
      if (!dragging) goto(index + 1);
    }, INTERVAL);
  };
  const stopAuto = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  // 드래그 (마우스/터치 공통 - Pointer Events)
  viewport.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    startX = e.clientX;
    startCurX = curX;
    setX(curX, false); // transition 제거
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    setX(startCurX + dx, false);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      viewport.releasePointerCapture(e.pointerId);
    } catch (_) {}
    // 가장 가까운 카드로 스냅
    const target = Math.round(-curX / step);
    if (target === index && curX === -index * step) {
      // 위치 변화 없음 → transitionend가 안 뜨므로 직접 정규화
      if (index >= 2 * N) goto(index - N, false);
      else if (index < N) goto(index + N, false);
    } else {
      goto(target, true);
    }
    startAuto();
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  // 드래그한 경우 카드 링크 클릭 방지
  track.addEventListener(
    'click',
    (e) => {
      if (moved > 6) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  // 이미지 네이티브 드래그(고스트) 방지
  track.addEventListener('dragstart', (e) => e.preventDefault());

  const recalc = () => {
    step = cards[0].getBoundingClientRect().width + gapOf();
    setX(-index * step, false);
  };
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(recalc, 150);
  });
  window.addEventListener('load', recalc);

  setX(curX, false);
  startAuto();
});
