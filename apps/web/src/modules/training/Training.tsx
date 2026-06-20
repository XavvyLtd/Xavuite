import { useState } from 'react';
import { useTrainingCourses, useTrainingAssignments } from '../../hooks/api';
import { Card, DataTable, MetricCard, MetricGrid, Tabs, StatusBadge, Avatar, Badge, Loading, Alert, ProgressBar, C, fmtDate } from '../../components/ui';

export function TrainingModule() {
  const [tab, setTab] = useState('courses');
  const { data:courses, isLoading:cL } = useTrainingCourses();
  const { data:assignments, isLoading:aL } = useTrainingAssignments();
  const allCourses = courses??[], allAssignments = assignments??[];
  const completed = allAssignments.filter(a=>a.status==='completed');
  const overdue   = allAssignments.filter(a=>a.status==='overdue'||(a.status!=='completed'&&a.due_date&&new Date(a.due_date)<new Date()));
  const mandatory = allAssignments.filter(a=>a.mandatory===1&&a.status!=='completed');

  return (
    <div className="animate-fadeIn">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:20}}>
        <div><h2 style={{color:C.text,fontSize:20,fontWeight:800,margin:0}}>Training Management</h2>
        <p style={{color:C.muted,fontSize:12,margin:'4px 0 0'}}>Mandatory and optional learning</p></div>
        <button style={{background:C.primary,color:'#fff',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Add Course</button>
      </div>
      {mandatory.length>0 && <Alert type="warning" message={`${mandatory.length} mandatory training item${mandatory.length>1?'s':''} incomplete`} />}
      <MetricGrid>
        <MetricCard label="Completed"   value={completed.length}  icon="🎓" color={`linear-gradient(135deg,${C.success},${C.secondary})`} />
        <MetricCard label="In Progress" value={allAssignments.filter(a=>a.status==='in_progress').length} icon="📚" color={`linear-gradient(135deg,${C.info},${C.primary})`} />
        <MetricCard label="Overdue"     value={overdue.length}    icon="⚠️" color={`linear-gradient(135deg,${C.danger},${C.warning})`} />
        <MetricCard label="Courses"     value={allCourses.length} icon="📖" color={`linear-gradient(135deg,${C.primary},#8B5CF6)`} />
      </MetricGrid>
      <Tabs tabs={[{key:'courses',label:'Courses'},{key:'assignments',label:'Assignments'}]} active={tab} onChange={setTab} />
      <Card>
        {tab==='courses' ? (cL?<Loading />:
          <DataTable cols={[
            { key:'name', label:'Course', render:v=><span style={{fontWeight:700}}>{v}</span> },
            { key:'mandatory', label:'Type', render:v=><Badge color={v?C.danger:C.secondary}>{v?'Mandatory':'Optional'}</Badge> },
            { key:'duration_hours', label:'Duration', render:v=>v?`${v}h`:'—', muted:true },
            { key:'assignment_count', label:'Assigned', muted:true },
            { key:'completed_count', label:'Completed', render:(v,r)=>(
              <div style={{display:'flex',alignItems:'center',gap:8,minWidth:100}}>
                <ProgressBar value={r.assignment_count>0?Math.round(v/r.assignment_count*100):0} color={C.success} height={4} />
                <span style={{fontSize:11,color:C.muted,flexShrink:0}}>{v}/{r.assignment_count}</span>
              </div>
            )},
          ]} rows={allCourses} emptyText="No courses" />
        ) : (aL?<Loading />:
          <DataTable cols={[
            { key:'employee_name', label:'Employee', render:v=><div style={{display:'flex',alignItems:'center',gap:8}}><Avatar name={v} size={26}/><span style={{fontWeight:600}}>{v}</span></div> },
            { key:'course_name', label:'Course' },
            { key:'mandatory', label:'Type', render:v=><Badge color={v?C.danger:C.secondary}>{v?'Mandatory':'Optional'}</Badge> },
            { key:'status', label:'Status', render:v=><StatusBadge status={v} /> },
            { key:'due_date', label:'Due', render:v=>fmtDate(v), muted:true },
            { key:'score', label:'Score', render:v=>v?<span style={{color:C.success,fontWeight:700}}>{v}%</span>:'—', muted:true },
          ]} rows={allAssignments} emptyText="No assignments" />
        )}
      </Card>
    </div>
  );
}
export default TrainingModule;
