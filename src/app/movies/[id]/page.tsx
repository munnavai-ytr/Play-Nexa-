'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Eye, ThumbsUp, MessageCircle, CheckCircle, Share2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import LoadingShimmer from '@/components/ui/LoadingShimmer'
import MovieCard from '@/components/movies/MovieCard'
import { useVideoDetail, useRelatedMovies } from '@/hooks/useMovies'

function DetailSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-grovix-bg">
      <LoadingShimmer className="w-full aspect-video" />
      <div className="px-4 pt-4 space-y-4">
        <LoadingShimmer className="h-6 w-3/4 rounded" />
        <LoadingShimmer className="h-4 w-1/2 rounded" />
        <LoadingShimmer className="h-20 w-full rounded-xl" />
        <LoadingShimmer className="h-16 w-full rounded-xl" />
      </div>
    </div>
  )
}

export default function MovieDetailPage() {
  const params = useParams()
  const router = useRouter()
  const videoId = params.id as string
  const [showMore, setShowMore] = useState(false)

  const { movie, loading, error } = useVideoDetail(videoId)
  const { movies: relatedMovies, loading: relatedLoading } = useRelatedMovies(
    movie?.title || '',
    videoId
  )

  if (loading) return <DetailSkeleton />

  if (error || !movie) {
    return (
      <div className="flex min-h-screen flex-col bg-grovix-bg">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-white font-semibold text-lg mb-2">
              Movie Not Found
            </p>
            <p className="text-grovix-muted text-sm mb-4">
              {error || 'This video may have been removed or is unavailable.'}
            </p>
            <button
              onClick={() => router.back()}
              className="bg-grovix-purple text-white rounded-xl px-6 py-3 text-sm font-semibold min-h-[44px] transition-opacity duration-150 hover:opacity-90"
              type="button"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isHindiDubbed =
    movie.language === 'Hindi' ||
    movie.language === 'Dubbed' ||
    movie.title.toLowerCase().includes('hindi dubbed')

  return (
    <div className="flex min-h-screen flex-col bg-grovix-bg">
      {/* Video Section */}
      <div className="relative">
        {/* Back button overlay */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white transition-colors duration-150 hover:bg-black/90 active:scale-90"
          aria-label="Go back"
          type="button"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Share button overlay */}
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: movie.title,
                url: `https://youtube.com/watch?v=${movie.videoId}`,
              })
            }
          }}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white transition-colors duration-150 hover:bg-black/90 active:scale-90"
          aria-label="Share"
          type="button"
        >
          <Share2 className="h-4 w-4" />
        </button>

        {/* YouTube iframe */}
        <div className="w-full aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${movie.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            style={{ border: 'none' }}
            title={movie.title}
          />
        </div>
      </div>

      <main className="flex-1 space-y-5 px-4 pt-4 pb-24">
        {/* Movie Info Section */}
        <section aria-label="Movie information">
          {/* Title */}
          <h1 className="text-lg font-bold text-white leading-snug">
            {movie.title}
          </h1>

          {/* REAL Stats Row */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-grovix-muted text-sm">
              <Eye size={14} />
              {movie.views}
            </span>
            <span className="flex items-center gap-1 text-grovix-muted text-sm">
              <ThumbsUp size={14} />
              {movie.likes}
            </span>
            <span className="flex items-center gap-1 text-grovix-muted text-sm">
              <MessageCircle size={14} />
              {movie.comments}
            </span>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap gap-2 mt-3">
            {movie.free && (
              <Badge variant="success">FREE</Badge>
            )}
            {isHindiDubbed && (
              <Badge variant="purple">Hindi Dubbed</Badge>
            )}
            <Badge variant="default">{movie.language}</Badge>
            <Badge variant="default">{movie.duration}</Badge>
            <Badge variant="default">YouTube</Badge>
          </div>
        </section>

        {/* Channel Info Section */}
        <section aria-label="Channel information">
          <div className="flex items-center gap-3 bg-grovix-card rounded-xl p-3 border border-grovix-border">
            {/* Channel avatar circle */}
            <div className="w-10 h-10 rounded-full bg-grovix-purple/20 flex items-center justify-center flex-shrink-0">
              <span className="text-grovix-purple font-bold text-sm">
                {movie.channel.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium truncate">
                  {movie.channel}
                </span>
                <CheckCircle className="w-4 h-4 text-grovix-cyan flex-shrink-0" />
              </div>
              <span className="text-grovix-muted text-xs">YouTube Channel</span>
            </div>
          </div>
        </section>

        {/* Description with expand/collapse */}
        <section aria-label="Description">
          <p
            className={`text-grovix-muted text-sm leading-relaxed ${
              !showMore ? 'line-clamp-3' : ''
            }`}
          >
            {movie.description}
          </p>
          <button
            type="button"
            onClick={() => setShowMore((prev) => !prev)}
            className="mt-1 text-grovix-purple text-sm font-medium transition-colors duration-150 hover:text-grovix-cyan min-h-[44px] flex items-center"
          >
            {showMore ? 'Show less' : 'Show more'}
          </button>
        </section>

        {/* Related Movies */}
        <section aria-label="Related movies">
          <h2 className="text-white font-semibold text-base mb-3">
            🎬 You May Also Like
          </h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {relatedLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <LoadingShimmer
                  key={i}
                  className="w-[148px] h-[120px] rounded-2xl flex-shrink-0"
                />
              ))
            ) : relatedMovies.length > 0 ? (
              relatedMovies.map((relMovie) => (
                <div key={relMovie.id} className="flex-shrink-0">
                  <MovieCard movie={relMovie} />
                </div>
              ))
            ) : (
              <p className="text-grovix-muted text-sm py-4">No related movies found</p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
