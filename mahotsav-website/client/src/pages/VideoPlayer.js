import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function VideoPlayer() {
  const { blockName, section } = useParams();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDriveLink, setIsDriveLink] = useState(false);
  const [driveFileId, setDriveFileId] = useState('');
  const [embedMethod, setEmbedMethod] = useState('iframe');
  const [videoType, setVideoType] = useState('local'); // 'youtube', 'gdrive', 'onedrive', 'local'

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

    // Microsoft OneDrive/SharePoint link detection (will use proxy)
    if (url.includes('onedrive.live.com') || url.includes('sharepoint.com') || url.includes('1drv.ms')) {
      return {
        url: `/api/video-proxy/onedrive?url=${encodeURIComponent(url)}`,
        isDrive: false, // Use video tag, not iframe
        fileId: '',
        type: 'onedrive'
      };
    }

    // Regular video URL (local or direct link)
    return { url, isDrive: false, type: 'local' };
  };

  const fetchVideo = useCallback(async () => {
    try {
      const response = await axios.get(`/api/blocks/${blockName}`);
      const block = response.data;
      const sectionData = block.sections.find(s => s.name === section);
      
      if (sectionData) {
        const { url, isDrive, fileId, type } = processVideoUrl(sectionData.video);
        setVideoUrl(url);
        setIsDriveLink(isDrive);
        setDriveFileId(fileId || '');
        setVideoType(type || 'local');
        setSectionName(sectionData.displayName);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching video:', error);
      setLoading(false);
    }
  }, [blockName, section]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="video-container">
      <button className="back-button" onClick={() => navigate(`/block/${blockName}`)}>
        ← Back to Block
      </button>
      <h1 className="title">{sectionName}</h1>
      
      {videoUrl && (
        isDriveLink && videoType === 'youtube' ? (
          <iframe
            className="video-player"
            src={videoUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={sectionName}
            style={{
              width: '100%',
              height: '600px',
              border: 'none',
              borderRadius: '8px'
            }}
          ></iframe>
        ) : (
          <div>
            <video
              className="video-player"
              controls
              autoPlay
              src={videoUrl}
              style={{
                width: '100%',
                maxHeight: '600px',
                borderRadius: '8px'
              }}
            >
              Your browser does not support the video tag.
            </video>
            {(videoType === 'gdrive' || videoType === 'onedrive') && (
              <div style={{
                marginTop: '15px',
                padding: '15px',
                background: '#e7f3ff',
                borderRadius: '5px',
                border: '1px solid #2196f3'
              }}>
                <p style={{ margin: '0', color: '#1565c0', fontSize: '14px' }}>
                  ℹ️ Video is being streamed from {videoType === 'gdrive' ? 'Google Drive' : 'OneDrive'} through your server.
                  {videoType === 'gdrive' && driveFileId && (
                    <span>
                      {' '}<a 
                        href={`https://drive.google.com/file/d/${driveFileId}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#1565c0', textDecoration: 'underline' }}
                      >
                        Open in Google Drive
                      </a>
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

export default VideoPlayer;
