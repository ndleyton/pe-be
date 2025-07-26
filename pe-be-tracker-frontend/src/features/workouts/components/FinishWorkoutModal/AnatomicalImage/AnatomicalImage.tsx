import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MuscleGroupSummary } from '@/utils/muscleGroups';
import { MUSCLE_GROUP_MAPPING, getMuscleGroupColor, DEFAULT_MUSCLE_COLOR } from '@/utils/anatomicalMapping';

interface AnatomicalImageProps {
  muscleGroupSummary: MuscleGroupSummary[];
}

const AnatomicalImage: React.FC<AnatomicalImageProps> = ({ muscleGroupSummary }) => {
  const [rawSvgContent, setRawSvgContent] = useState<string | null>(null);

  // Fetch the raw SVG content once on mount
  useEffect(() => {
    const fetchSvg = async () => {
      try {
        const svgPath = '/assets/anatomy/basic-human-body.svg';
        const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3000';
        const fullUrl = new URL(svgPath, baseUrl).href;
        
        const response = await fetch(fullUrl);
        const svgText = await response.text();
        setRawSvgContent(svgText);
      } catch (error) {
        console.error('Error fetching SVG:', error);
      }
    };

    fetchSvg();
  }, []);

  // Process the SVG content using useMemo to prevent unnecessary re-renders
  const processedSvgContent = useMemo(() => {
    if (!rawSvgContent) return null;


    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(rawSvgContent, 'image/svg+xml');
    const svgElement = svgDoc.documentElement as unknown as SVGSVGElement;

    // Reset all muscle paths to the default color first
    Object.values(MUSCLE_GROUP_MAPPING).flat().forEach(id => {
      const musclePath = svgElement.querySelector(`#${id}`);
      if (musclePath) {
        musclePath.style.fill = DEFAULT_MUSCLE_COLOR;
      }
    });

    const maxSets = muscleGroupSummary.reduce((max, group) => Math.max(max, group.setCount), 0);

    // Apply intensity-based color only to worked-out muscle groups
    muscleGroupSummary.forEach(group => {
      const intensity = maxSets > 0 ? group.setCount / maxSets : 0;
      const color = getMuscleGroupColor(intensity);

      const svgMuscleIds = MUSCLE_GROUP_MAPPING[group.name];
      if (svgMuscleIds) {
        svgMuscleIds.forEach(id => {
          const musclePath = svgElement.querySelector(`#${id}`);
          if (musclePath) {
            musclePath.style.fill = color;
          } else {
            console.warn(`  - SVG element #${id} not found in anatomy SVG`);
          }
        });
      } else {
        console.warn(`No muscle mapping found for group: "${group.name}"`);
      }
    });

    // Ensure the SVG has proper styling for responsive behavior
    svgElement.setAttribute('class', 'w-full max-w-full h-auto');
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgElement.setAttribute('role', 'img');
    svgElement.setAttribute('aria-label', 'Anatomical muscle diagram');

    return new XMLSerializer().serializeToString(svgElement);
  }, [rawSvgContent, muscleGroupSummary]);

  if (!processedSvgContent) {
    return <div>Loading anatomical image...</div>;
  }

  return (
    <div className="anatomical-image-container w-full h-full">
      <div
        className="w-full h-full"
        dangerouslySetInnerHTML={{ __html: processedSvgContent }}
      />
    </div>
  );
};

export default AnatomicalImage;