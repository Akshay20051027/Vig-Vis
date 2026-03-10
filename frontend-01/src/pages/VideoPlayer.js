import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { cacheRead, cacheWrite } from '../utils/sessionCache';

const blockCacheKey = (blockName) => `block.${blockName}.v1`;

function VideoPlayer() {
  const { blockName, section } = useParams();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDriveLink, setIsDriveLink] = useState(false);
  const [driveFileId, setDriveFileId] = useState('');
  const [embedMethod, setEmbedMethod] = useState('iframe');
  const [videoType, setVideoType] = useState('local'); // 'youtube', 'gdrive', 'local'

  // Convert drive links to embeddable format
  const processVideoUrl = (url) => {
    if (!url) return { url: '', isDrive: false, type: 'local' };

    // YouTube link detection and conversion
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      
      // Format: https://www.youtube.com/watch?v=VIDEO_ID
      const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      if (watchMatch) {
        videoId = watchMatch[1];
      }
      
      // Format: https://youtu.be/VIDEO_ID
      const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
      if (shortMatch) {
        videoId = shortMatch[1];
      }

      if (videoId) {
        return {
          url: `https://www.youtube.com/embed/${videoId}`,
          isDrive: true,
          fileId: videoId,
          type: 'youtube'
        };
      }
    }

    // Google Drive link detection (will use proxy)
    if (url.includes('drive.google.com')) {
      let fileId = '';
      
      const viewMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (viewMatch) {
        fileId = viewMatch[1];
      }
      
      const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (openMatch) {
        fileId = openMatch[1];
      }

      if (fileId) {
        return {
          url: `/api/video-proxy/gdrive/${fileId}`,
          isDrive: false, // Use video tag, not iframe
          fileId: fileId,
          type: 'gdrive'
        };
      }
    }

    // Microsoft OneDrive/SharePoint link detection
    if (url.includes('onedrive.live.com') || url.includes('sharepoint.com') || url.includes('1drv.ms')) {
      // Try to use embed format for OneDrive videos
      if (url.includes('/embed')) {
        // Already an embed link
        return { url, isDrive: true, fileId: '', type: 'onedrive' };
      }
      
      // Convert sharing link to embed link for iframe
      if (url.includes('onedrive.live.com') || url.includes('1drv.ms')) {
        let embedUrl = url;
        
        // Convert view to embed
        embedUrl = embedUrl
          .replace('/view', '/embed')
          .replace('/redir', '/embed')
          .replace('?', '/embed?');
        
        // If it's a 1drv.ms link, we'll use the proxy instead
        if (url.includes('1drv.ms')) {
          return {
            url: `/api/video-proxy/onedrive?url=${encodeURIComponent(url)}`,
            isDrive: false, // Use video tag with proxy
            fileId: '',
            type: 'onedrive'
          };
        }
        
        return { url: embedUrl, isDrive: true, fileId: '', type: 'onedrive' };
      }
      
      // For SharePoint, the link usually works as-is for embedding
      return { url, isDrive: true, fileId: '', type: 'sharepoint' };
    }

    // Regular video URL (local or direct link)
    return { url, isDrive: false, type: 'local' };
  };

  const fetchVideo = useCallback(async () => {
    const applyFromBlock = async (block) => {
      const routeSection = decodeURIComponent(section || '').trim().toLowerCase();
      const sectionData = block?.sections?.find((s) => {
        const candidates = [s?.name, s?.displayName]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase());
        return candidates.includes(routeSection);
      });
      
      if (sectionData) {
        if (!sectionData.video) {
          setError('No video configured for this section');
          setSectionName(sectionData.displayName);
          setLoading(false);
          return;
        }

        setSourceUrl(sectionData.video);

        // Special handling for OneDrive short links: resolve to an embed-capable URL.
        if (sectionData.video.includes('1drv.ms')) {
          try {
            const resolvedResp = await axios.get(`/api/video-proxy/onedrive-resolve?url=${encodeURIComponent(sectionData.video)}`);
            const resolved = resolvedResp?.data?.resolved || sectionData.video;
            const embedCandidate = resolvedResp?.data?.embedCandidate;

            setVideoUrl(embedCandidate || resolved);
            setIsDriveLink(true);
            setDriveFileId('');
            setVideoType('onedrive');
            setSectionName(sectionData.displayName);
            setLoading(false);
            return;
          } catch (resolveError) {
            console.error('Failed to resolve 1drv.ms link:', resolveError);
            // Fall back to normal processing (may show a helpful proxy error)
          }
        }

        const { url, isDrive, fileId, type } = processVideoUrl(sectionData.video);
        setVideoUrl(url);
        setIsDriveLink(isDrive);
        setDriveFileId(fileId || '');
        setVideoType(type || 'local');
        setSectionName(sectionData.displayName);
      } else {
        setError('Section not found');
      }
      setLoading(false);
    };

    const cached = cacheRead(blockCacheKey(blockName), null);
    const hadCache = !!cached;

    try {
      if (hadCache) {
        await applyFromBlock(cached);
      } else {
        setLoading(true);
      }

      // Always revalidate in background.
      const response = await axios.get(`/api/blocks/${blockName}`);
      cacheWrite(blockCacheKey(blockName), response.data);
      await applyFromBlock(response.data);
    } catch (error) {
      console.error('Error fetching video:', error);
      if (!hadCache) {
        setError(error.response?.data?.message || 'Failed to load video information');
        setLoading(false);
      }
    }
  }, [blockName, section]);

  const handleVideoError = async (e) => {
    console.error('Video playback error:', e);
    console.error('Video URL:', videoUrl);
    console.error('Video type:', videoType);
    console.error('Error details:', e.target.error);

    if (videoUrl?.startsWith('/api/video-proxy/onedrive')) {
      try {
        const proxyResponse = await axios.get(videoUrl);
        const proxyError = proxyResponse?.data?.error;
        const proxyHint = proxyResponse?.data?.hint;

        if (proxyHint || proxyError) {
          setError([proxyError, proxyHint].filter(Boolean).join(' '));
          return;
        }
      } catch (proxyError) {
        const proxyErrorMessage = proxyError?.response?.data?.error;
        const proxyHintMessage = proxyError?.response?.data?.hint;

        if (proxyHintMessage || proxyErrorMessage) {
          setError([proxyErrorMessage, proxyHintMessage].filter(Boolean).join(' '));
          return;
        }
      }
    }

    setError(`Failed to load video. URL: ${videoUrl}. The video file may not exist or is not accessible.`);
  };

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  if (loading) {
    return (
      <div className="video-container">
        <button className="back-button" onClick={() => navigate(`/block/${blockName}`)}>
          ← Back to Block
        </button>
        <div className="loading">Loading video...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-container">
        <button className="back-button" onClick={() => navigate(`/block/${blockName}`)}>
          ← Back to Block
        </button>
        <h1 className="title">{sectionName || 'Video Player'}</h1>
        <div className="video-stream-note" style={{ maxWidth: '700px', margin: '0 auto', marginTop: '100px' }}>
          <p style={{ fontSize: '18px', color: 'var(--accent-red)' }}>
            ⚠️ Video Loading Error
          </p>
          <p style={{ marginTop: '16px', color: 'var(--text-strong)' }}>
            {error}
          </p>
          {videoType === 'onedrive' && (
            <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', textAlign: 'left' }}>
              <p style={{ fontWeight: '600', marginBottom: '12px' }}>💡 OneDrive Video Solutions:</p>
              <ol style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                <li><strong>Download and upload:</strong> Download the video from OneDrive and upload it through the Admin Dashboard</li>
                <li><strong>Use YouTube:</strong> Upload to YouTube (can be unlisted) and use that link instead</li>
                <li><strong>Use embed code:</strong> In OneDrive, click Share → Embed, and use that full embed URL (not the short link)</li>
              </ol>
              <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>
                Note: OneDrive short links (1drv.ms) don't support direct video streaming
              </p>
            </div>
          )}
          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>
            Please contact an administrator to update the video configuration.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-container">
      <button className="back-button" onClick={() => navigate(`/block/${blockName}`)}>
        ← Back to Block
      </button>
      <h1 className="title">{sectionName}</h1>
      
      {videoUrl ? (
        <div className="video-player-wrapper">
          {isDriveLink && (videoType === 'youtube' || videoType === 'onedrive' || videoType === 'sharepoint') ? (
            <>
              <div className="video-player">
                <iframe
                  src={videoUrl}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={sectionName}
                  onError={handleVideoError}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: '16px'
                  }}
                ></iframe>
              </div>

              {(videoType === 'onedrive' || videoType === 'sharepoint') && sourceUrl && (
                <div className="video-stream-note">
                  <p>
                    If the embedded player is blocked,{' '}
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="video-stream-link"
                    >
                      open in OneDrive
                    </a>
                    .
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="video-player">
                <video
                  controls
                  autoPlay
                  src={videoUrl}
                  onError={handleVideoError}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '16px',
                    backgroundColor: '#000'
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              {(videoType === 'gdrive' || videoType === 'onedrive') && (
                <div className="video-stream-note">
                  <p>
                    ℹ️ Video is being streamed from {videoType === 'gdrive' ? 'Google Drive' : 'OneDrive'} through your server.
                    {videoType === 'gdrive' && driveFileId && (
                      <span>
                        {' '}<a 
                          href={`https://drive.google.com/file/d/${driveFileId}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="video-stream-link"
                        >
                          Open in Google Drive
                        </a>
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="video-stream-note" style={{ maxWidth: '600px', margin: '0 auto', marginTop: '100px' }}>
          <p style={{ fontSize: '18px' }}>
            ℹ️ No video available for this section
          </p>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
