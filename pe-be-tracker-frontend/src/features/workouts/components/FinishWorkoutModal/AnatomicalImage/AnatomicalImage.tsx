import React, { useEffect, useRef, useState } from 'react';
import { MuscleGroupSummary } from '@/utils/muscleGroups';
import { MUSCLE_GROUP_MAPPING, getMuscleGroupColor, DEFAULT_MUSCLE_COLOR } from '@/utils/anatomicalMapping';

interface AnatomicalImageProps {
  muscleGroupSummary: MuscleGroupSummary[];
}

const AnatomicalImage: React.FC<AnatomicalImageProps> = ({ muscleGroupSummary }) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchSvg = async () => {
      try {
        const svgPath = '/assets/anatomy/basic-human-body.svg';
        const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3000';
        const fullUrl = new URL(svgPath, baseUrl).href;
        
        const response = await fetch(fullUrl);
        const svgText = await response.text();
        setSvgContent(svgText);
      } catch (error) {
        console.error('Error fetching SVG:', error);
      }
    };

    fetchSvg();
  }, []);

  useEffect(() => {
    if (svgContent) {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.documentElement as unknown as SVGSVGElement;

      const maxSets = muscleGroupSummary.reduce((max, group) => Math.max(max, group.setCount), 0);

      // Apply default color to all known muscle groups first
      Object.values(MUSCLE_GROUP_MAPPING).flat().forEach(id => {
        const musclePath = svgElement.getElementById ? 
          svgElement.getElementById(id) : 
          svgElement.querySelector(`#${id}`);
        if (musclePath) {
          musclePath.removeAttribute('class'); // Ensure no CSS class interferes
          musclePath.setAttribute('fill', DEFAULT_MUSCLE_COLOR);
        }
      });

      // Apply intensity-based color to worked-out muscle groups
      muscleGroupSummary.forEach(group => {
        const intensity = maxSets > 0 ? group.setCount / maxSets : 0;
        const color = getMuscleGroupColor(intensity);

        const svgMuscleIds = MUSCLE_GROUP_MAPPING[group.name];
        if (svgMuscleIds) {
          svgMuscleIds.forEach(id => {
            const musclePath = svgElement.getElementById ? 
              svgElement.getElementById(id) : 
              svgElement.querySelector(`#${id}`);
            if (musclePath) {
              musclePath.removeAttribute('class'); // Ensure no CSS class interferes
              musclePath.setAttribute('fill', color);
            }
          });
        }
      });
      setSvgContent(new XMLSerializer().serializeToString(svgElement));
    }
  }, [svgContent, muscleGroupSummary]);

  if (!svgContent) {
    return <div>Loading anatomical image...</div>;
  }

  return (
    <div className="anatomical-image-container w-full h-full">
      {/* Temporarily remove ReactSVGPanZoom */}
      <svg
        viewBox="0 0 1064 827"
        className="w-full max-w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Anatomical muscle diagram"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
};

export default AnatomicalImage;