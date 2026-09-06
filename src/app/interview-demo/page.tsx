import { InterviewWalkthrough } from "@/components/interview/InterviewWalkthrough";
import { resolveInterviewChapter } from "@/lib/interviewGuide";

export default function InterviewDemoPage({ searchParams }: { searchParams: { chapter?: string | string[] } }) {
  return <InterviewWalkthrough {...resolveInterviewChapter(searchParams.chapter)} />;
}
