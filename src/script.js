/* ============================================================
   의정종합법률사무소 — 인터랙션
   ============================================================ */

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

/* ---------- 변제금 진단: 선택지 토글 ---------- */
document.querySelectorAll('[data-diag-opts]').forEach((group) => {
  group.querySelectorAll('[data-diag-opt]').forEach((opt) => {
    opt.addEventListener('click', () => {
      group.querySelectorAll('[data-diag-opt]').forEach((o) => o.classList.remove('is-on'));
      opt.classList.add('is-on');
    });
  });
});

/* ---------- 상단 이동(TOP) ---------- */
const quickTop = document.getElementById('quickTop');
if (quickTop) {
  quickTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ---------- 상담 신청 폼 ---------- */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
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
    alert('상담 신청이 접수되었습니다.\n담당자가 순차적으로 연락드리겠습니다.');
    contactForm.reset();
  });
}

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
  const getStep = () => cards[0].getBoundingClientRect().width + getGap();
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
      const cardW = cards[0].getBoundingClientRect().width;
      x = -(index * step) + (vpW / 2 - cardW / 2);
      cards.forEach((c, i) => {
        c.classList.toggle('is-center', i === index);
        c.classList.toggle('is-near', i === index - 1 || i === index + 1);
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
