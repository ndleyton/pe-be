import React from 'react';

interface Workout {
  id: number | string;
  name: string | null;
  notes: string | null;
  start_time: string;
  end_time: string | null;
}

interface WeekTrackingProps {
  workouts: Workout[];
  className?: string;
}

const WeekTracking: React.FC<WeekTrackingProps> = ({ workouts, className = '' }) => {
  const getLast7Days = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date);
    }
    
    return days;
  };

  const hasWorkoutOnDate = (date: Date) => {
    const dateString = date.toDateString();
    return workouts.some(workout => {
      const workoutDate = new Date(workout.start_time);
      return workoutDate.toDateString() === dateString;
    });
  };

  const getDayName = (date: Date) => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return days[date.getDay()];
  };

  const last7Days = getLast7Days();

  return (
    <div className={`bg-base-100 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-medium text-base-content/70 mb-3">Week Activity</h3>
      <div className="flex justify-between items-center gap-1">
        {last7Days.map((date, index) => {
          const hasWorkout = hasWorkoutOnDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          
          return (
            <div key={index} className="flex flex-col items-center gap-1">
              <span className={`text-xs ${isToday ? 'text-primary font-medium' : 'text-base-content/60'}`}>
                {getDayName(date)}
              </span>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  hasWorkout
                    ? 'bg-warning text-warning-content'
                    : 'bg-base-200 border-2 border-base-300'
                }`}
                title={`${date.toLocaleDateString()}: ${hasWorkout ? 'Workout completed' : 'No workout'}`}
              >
                {hasWorkout ? (
                  <span
                    role="img"
                    aria-label="Workout logged"
                    className="text-lg leading-none select-none"
                  >
                    🔥
                  </span>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-base-300" />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-base-content/50 mt-2">
        <span>7 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
};

export default WeekTracking;