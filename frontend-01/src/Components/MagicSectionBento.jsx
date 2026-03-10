import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './MagicSectionBento.css';

const CARD_TONES = ['indigo', 'teal', 'blue', 'violet'];

function getPlayableSource(url) {
  if (!url) return null;

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    const videoId = (watchMatch && watchMatch[1]) || (shortMatch && shortMatch[1]);

    if (videoId) {
      return {
        kind: 'iframe',
        src: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0`
      };
    }
  }

  if (url.includes('drive.google.com')) {
    const viewMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = (viewMatch && viewMatch[1]) || (openMatch && openMatch[1]);

    if (fileId) {
      return {
        kind: 'video',
        src: `/api/video-proxy/gdrive/${fileId}`
      };
    }
  }

  if (url.includes('onedrive.live.com') || url.includes('sharepoint.com') || url.includes('1drv.ms')) {
    if (url.includes('/embed')) {
      return { kind: 'iframe', src: url };
    }

    if (url.includes('1drv.ms')) {
      return {
        kind: 'video',
        src: `/api/video-proxy/onedrive?url=${encodeURIComponent(url)}`
      };
    }

    return {
      kind: 'iframe',
      src: url
    };
  }

  return {
    kind: 'video',
    src: url
  };
}

function MagicSectionBento({
  blockDisplayName,
  blockImage,
  sections = [],
  onSectionClick,
  onBlockPreviewClick,
  disableAnimations = false,
  isMobile = false
}) {
  const gridRef = useRef(null);

  useEffect(() => {
    if (disableAnimations || isMobile || !gridRef.current) return;

    const cards = gridRef.current.querySelectorAll('.magic-bento-card');
    if (!cards.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cards,
        {
          autoAlpha: 0,
          y: 50,
          scale: 0.95
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.68,
          ease: 'power3.out',
          stagger: 0.17,
          clearProps: 'transform,opacity,visibility'
        }
      );
    }, gridRef);

    return () => ctx.revert();
  }, [disableAnimations, isMobile]);

  const updateGlowPosition = (card, event) => {
    const rect = card.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * 100;
    const relativeY = ((event.clientY - rect.top) / rect.height) * 100;

    card.style.setProperty('--glow-x', `${relativeX}%`);
    card.style.setProperty('--glow-y', `${relativeY}%`);
  };

  const handleGlowEnter = (event) => {
    const card = event.currentTarget;
    updateGlowPosition(card, event);

    gsap.to(card, {
      '--glow-intensity': 1,
      '--glow-radius': '260px',
      duration: 0.24,
      ease: 'power2.out'
    });
  };

  const handleGlowMove = (event) => {
    const card = event.currentTarget;
    updateGlowPosition(card, event);
  };

  const handleGlowLeave = (event) => {
    const card = event.currentTarget;

    gsap.to(card, {
      '--glow-intensity': 0,
      '--glow-radius': '170px',
      duration: 0.35,
      ease: 'power2.out'
    });
  };

  const glowHandlers = {
    onMouseEnter: handleGlowEnter,
    onMouseMove: handleGlowMove,
    onMouseLeave: handleGlowLeave
  };

  const sectionCards = sections
    .map((section, index) => {
      const routeSectionKey = section.name || section.displayName;
      if (!routeSectionKey) return null;

      return {
        id: `${routeSectionKey}-${index}`,
        routeSectionKey,
        title: section.displayName || section.name,
        tone: CARD_TONES[index % CARD_TONES.length],
        source: getPlayableSource(section.video)
      };
    })
    .filter(Boolean);

  return (
    <section className="magic-bento-shell" aria-label="Block sections">
      <div ref={gridRef} className="magic-bento-grid">
        <article className="magic-bento-card magic-bento-card--border-glow magic-bento-card--image" {...glowHandlers}>
          {blockImage ? (
            <img src={blockImage} alt={blockDisplayName} className="magic-bento-hero-image" />
          ) : (
            <div className="magic-bento-empty-media">
              <strong>No image uploaded yet</strong>
              <small>Upload from dashboard to display a block preview.</small>
            </div>
          )}
        </article>

        <div className="magic-bento-sections">
          {sectionCards.length > 0 ? (
            sectionCards.map((card) => (
              <article
                key={card.id}
                className={`magic-bento-card magic-bento-card--border-glow magic-bento-card--section magic-bento-card--${card.tone}`}
                title={`Open ${card.title}`}
                {...glowHandlers}
              >
                <div className="magic-bento-video-wrap">
                  {card.source ? (
                    card.source.kind === 'iframe' ? (
                      <iframe
                        src={card.source.src}
                        title={card.title}
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                        className="magic-bento-media"
                      />
                    ) : (
                      <video
                        src={card.source.src}
                        className="magic-bento-media"
                        controls
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    )
                  ) : (
                    <div className="magic-bento-empty-media magic-bento-empty-media--section">
                      <strong>No video configured</strong>
                      <small>Use dashboard to add a section video.</small>
                    </div>
                  )}

                  <div className="magic-bento-overlay-bottom">
                    <h3>{card.title}</h3>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <article className="magic-bento-card magic-bento-card--border-glow magic-bento-card--section magic-bento-card--empty" {...glowHandlers}>
              <div className="magic-bento-card__body">
                <h3>No sections yet</h3>
                <p>Add classrooms, labs or other sections from the dashboard.</p>
              </div>
            </article>
          )}
        </div>

      </div>
    </section>
  );
}

export default MagicSectionBento;
