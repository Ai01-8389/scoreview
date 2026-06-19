import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import ScoreInput from '@/pages/ScoreInput';
import Compare from '@/pages/Compare';
import TargetAnalysis from '@/pages/TargetAnalysis';
import SubScoreAnalysis from '@/pages/SubScoreAnalysis';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/input" element={<ScoreInput />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/target" element={<TargetAnalysis />} />
          <Route path="/detail" element={<SubScoreAnalysis />} />
        </Route>
      </Routes>
    </Router>
  );
}
