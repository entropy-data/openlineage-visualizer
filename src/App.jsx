import React from 'react';
import LineageCanvas from './LineageCanvas';

export default function App({ graphData }) {
  return <LineageCanvas graph={graphData.graph} />;
}
