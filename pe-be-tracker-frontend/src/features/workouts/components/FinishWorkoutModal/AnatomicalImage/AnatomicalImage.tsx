import React, { useEffect, useRef, useState } from 'react';
import { MuscleGroupSummary } from '@/utils/muscleGroups';
import { UncontrolledReactSVGPanZoom } from 'react-svg-pan-zoom';
import { MUSCLE_GROUP_MAPPING, getMuscleGroupColor } from '@/utils/anatomicalMapping';

interface AnatomicalImageProps {
  muscleGroupSummary: MuscleGroupSummary[];
}

const AnatomicalImage: React.FC<AnatomicalImageProps> = ({ muscleGroupSummary }) => {
  const Viewer = useRef(null);
  const [rawSvg, setRawSvg] = useState<string | null>(null);
  const [coloredSvg, setColoredSvg] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState<string>('0 0 500 500');

  useEffect(() => {
    const fetchSvg = async () => {
      try {
        const response = await fetch('/assets/anatomy/basic-human-body.svg');
        const svgText = await response.text();
        setRawSvg(svgText);
      } catch (error) {
        console.error('Error fetching SVG:', error);
      }
    };

    fetchSvg();
  }, []);

  useEffect(() => {
    if (rawSvg) {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(rawSvg, 'image/svg+xml');
      const svgElement = svgDoc.documentElement as unknown as SVGSVGElement;

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
      setViewBox(svgElement.getAttribute('viewBox') || '0 0 500 500');
      setColoredSvg(svgElement.innerHTML);
    }
  }, [rawSvg, muscleGroupSummary]);

  if (!coloredSvg) {
    return <div>Loading anatomical image...</div>;
  }

  return (
    <div className="anatomical-image-container w-full h-full">
      <UncontrolledReactSVGPanZoom
        width={500}
        height={500}
        ref={Viewer}
        SVGBackground="transparent"
        background="transparent"
        detectAutoPan={false}
        toolbarProps={{
          position: 'none',
        }}
        miniatureProps={{
          position: 'none'
        }}
      >
        <svg
          width={500}
          height={500}
          viewBox={viewBox}
          dangerouslySetInnerHTML={{ __html: coloredSvg }}
        />
      </UncontrolledReactSVGPanZoom>
    </div>
  );
};

export default AnatomicalImage;