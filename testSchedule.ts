
const calculateTotalDuration = (task: any, type: string): number => {
    const videosDuration = task.videos?.reduce((acc: number, v: any) => acc + (Number(v.duration) || 0), 0) || 0;
    return (videosDuration > 0 ? videosDuration : (Number(task.duration) || 30));
};

const task = {
    videos: [
        { title: 'V1', duration: 42 },
        { title: 'V2', duration: 41 },
        { title: 'V3', duration: 23 },
        { title: 'V4', duration: 44 },
        { title: 'V5', duration: 57 },
        { title: 'V6', duration: 30 }
    ],
    duration: 0
};

const routine = { 0: 0, 1: 42, 2: 165, 3: 0, 4: 0, 5: 0, 6: 0 };
let remainingDuration = calculateTotalDuration(task, 'lesson');
const currentDate = new Date('2026-03-09');
let currentDayCapacity = 42; // Day 11 (Monday)
let part = 1;
const videos = [...task.videos];

console.log(`Total duration: ${remainingDuration}`);

while (remainingDuration > 0) {
    let allocatedTime = remainingDuration;
    if (allocatedTime > currentDayCapacity) {
        allocatedTime = currentDayCapacity;
    }

    console.log(`Part ${part}: allocatedTime ${allocatedTime}, remainingDuration ${remainingDuration}`);

    const currentPartVideos = [];
    let videosDuration = 0;
    while (videos.length > 0 && videosDuration + (Number(videos[0].duration) || 0) <= allocatedTime) {
        const v = videos.shift();
        currentPartVideos.push(v);
        videosDuration += (Number(v.duration) || 0);
    }
    console.log(`Part ${part} videos added: ${currentPartVideos.length}`);

    remainingDuration -= allocatedTime;
    currentDayCapacity = 165; // Day 12 (Tuesday)
    part++;
}
