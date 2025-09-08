-- atomic matchmaking script for redis
-- keys: interest queues
-- argv[1]: userid
-- argv[2]: active expiry (seconds)
-- argv[3]: fallback interest name

local function matchUser(queues, userId, activeExpiry, fallbackInterest)
  for i, queue in ipairs(queues) do
    local matchId = redis.call('lpop', queue)
    while matchId do
      if matchId ~= userId then
        local lockKey = 'lock:' .. matchId
        local lock = redis.call('set', lockKey, userId, 'NX', 'PX', 5000)
        if lock then
          if redis.call('get', 'active:' .. matchId) == 'waiting' then
            -- mark both users as matched
            redis.call('set', 'active:' .. userId, 'matched', 'EX', activeExpiry)
            redis.call('set', 'active:' .. matchId, 'matched', 'EX', activeExpiry)
            
            -- remove both users from all possible interest queues
            local allQueues = redis.call('keys', 'queue:*')
            for _, q in ipairs(allQueues) do
              redis.call('lrem', q, 0, userId)
              redis.call('lrem', q, 0, matchId)
            end
            
            -- only delete lock if you still own it
            if redis.call('get', lockKey) == userId then
              redis.call('del', lockKey)
            end
            
            return {matchId, queue}
          else
            -- only delete lock if you still own it
            if redis.call('get', lockKey) == userId then
              redis.call('del', lockKey)
            end
            -- put the user back in the queue since they didn't match
            redis.call('rpush', queue, matchId)
          end
        else
          -- put the user back in the queue since we couldn't get a lock
          redis.call('rpush', queue, matchId)
        end
      else
        -- put the user back in the queue since it's the same user
        redis.call('rpush', queue, matchId)
      end
      matchId = redis.call('lpop', queue)
    end
  end
  return nil
end

-- main execution
local userId = ARGV[1]
local activeExpiry = tonumber(ARGV[2])
local fallbackInterest = ARGV[3]

return matchUser(KEYS, userId, activeExpiry, fallbackInterest) 