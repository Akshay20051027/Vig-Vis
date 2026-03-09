import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function VideoPlayer() {
  const { blockName, section } = useParams();
  const navigate = useNavigate();
  const [videoUrl, setVideoUrl] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchVideo = useCallback(async () => {
    try {
      const response = await axios.get(`/api/blocks/${blockName}`);
      const block = response.data;
      const sectionData = block.sections.find(s => s.name === section);
      
      if (sectionData) {
        setVideoUrl(sectionData.video);
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
        <video
          className="video-player"
          controls
          autoPlay
          src={videoUrl}
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>
  );
}

export default VideoPlayer;
