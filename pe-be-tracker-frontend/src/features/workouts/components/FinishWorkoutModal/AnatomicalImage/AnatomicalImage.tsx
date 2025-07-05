import React, { useEffect, useRef, useState } from 'react';
import { MuscleGroupSummary } from '@/utils/muscleGroups';
import { ReactSVGPanZoom } from 'react-svg-pan-zoom';
import { MUSCLE_GROUP_MAPPING, getMuscleGroupColor } from '@/utils/anatomicalMapping';

interface AnatomicalImageProps {
  muscleGroupSummary: MuscleGroupSummary[];
}

const AnatomicalImage: React.FC<AnatomicalImageProps> = ({ muscleGroupSummary }) => {
  const Viewer = useRef(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchSvg = async () => {
      try {
        const response = await fetch('/assets/anatomy/basic-human-body.svg');
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
      const svgElement = svgDoc.documentElement;

      const maxSets = muscleGroupSummary.reduce((max, group) => Math.max(max, group.setCount), 0);

      muscleGroupSummary.forEach(group => {
        const intensity = maxSets > 0 ? group.setCount / maxSets : 0;
        const color = getMuscleGroupColor(intensity);

        const svgMuscleIds = MUSCLE_GROUP_MAPPING[group.name];
        if (svgMuscleIds) {
          svgMuscleIds.forEach(id => {
            const musclePath = svgElement.getElementById(id);
            if (musclePath) {
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
      <ReactSVGPanZoom
        width={500}
        height={500}
        ref={Viewer}
        SVGBackground="#fff"
        background="#fff"
        detectAutoPan={false}
        toolbarProps={{
          position: 'none',
        }}
        miniatureProps={{
          position: 'none'
        }}
      >
        <svg width={500} height={500} dangerouslySetInnerHTML={{ __html: svgContent }} />
      </ReactSVGPanZoom>
    </div>
  );
};

export default AnatomicalImage;