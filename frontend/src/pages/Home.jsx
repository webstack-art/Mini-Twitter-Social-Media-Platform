import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Home = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [postContent, setPostContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTimeline();
  }, []);

  const fetchTimeline = async () => {
    try {
      const res = await axios.get('/api/posts');
      setPosts(res.data);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    }
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    try {
      setLoading(true);
      await axios.post('/api/posts', { content: postContent });
      setPostContent('');
      fetchTimeline(); // Refresh the timeline
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      await axios.post(`/api/posts/${postId}/like`);
      fetchTimeline(); // Refresh the timeline to update like count
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Post */}
      {user && (
        <div className="bg-white p-4 rounded-lg shadow">
          <form onSubmit={handlePostSubmit}>
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder={`What's happening, ${user.username}?`}
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
              maxLength="280"
            />
            <div className="flex justify-end mt-3">
              <span className="text-sm text-gray-500 mr-3">{postContent.length}/280</span>
              <button
                type="submit"
                disabled={loading || !postContent.trim()}
                className={`px-4 py-2 rounded-full font-medium ${
                  loading || !postContent.trim()
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {loading ? 'Posting...' : 'Tweet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post._id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-start space-x-3">
              {post.userId?.profilePic ? (
                <img
                  src={post.userId.profilePic}
                  alt={post.userId.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-600 font-medium">
                    {post.userId?.username?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{post.userId?.username}</span>
                  <span className="text-gray-500 text-sm">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-gray-800">{post.content}</p>
                <div className="flex items-center mt-3 space-x-4">
                  <button
                    onClick={() => handleLike(post._id)}
                    className="flex items-center space-x-1 text-gray-500 hover:text-red-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill={post.likes?.includes(user?._id) ? 'currentColor' : 'none'}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                    <span>{post.likes?.length || 0}</span>
                  </button>
                  <button className="flex items-center space-x-1 text-gray-500 hover:text-blue-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    <span>0</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;