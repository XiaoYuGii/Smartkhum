# SmartKhum Backend
# Ruby + Sinatra + SQLite
# Connects villagers -> AI classification -> Map/Dashboard -> Authority action

require 'sinatra/base'
require 'sinatra/json'
require 'sqlite3'
require 'json'
require 'time'

class SmartKhum < Sinatra::Base
  DB_PATH = File.join(__dir__, 'db', 'smartkhum.db')

  configure do
    set :public_folder, File.join(__dir__, 'public')
    set :views, File.join(__dir__, 'views')
    set :bind, '0.0.0.0'
    set :port, 4567
  end

  # ---------- Database helpers ----------

  def db
    database = SQLite3::Database.new(DB_PATH)
    database.results_as_hash = true
    database.execute('PRAGMA foreign_keys = ON')
    database
  end

  def self.init_db!
    database = SQLite3::Database.new(DB_PATH)
    schema = File.read(File.join(__dir__, 'db', 'schema.sql'))
    database.execute_batch(schema)
    database.close
  end

  # ---------- "AI Engine" simulation ----------
  # Stage 2 of the flow: classify category + assign priority from free text.
  # In a production system this would call an NLP/speech-to-text model;
  # here we simulate it with keyword matching in Khmer + English so the
  # whole pipeline (submit -> classify -> map -> authority) works end-to-end.

  CATEGORY_KEYWORDS = {
    'water' => ['ទឹក', 'water', 'flood', 'ជំនន់', 'ស្ទឹង', 'pipe', 'well', 'អណ្តូង'],
    'road' => ['ផ្លូវ', 'road', 'bridge', 'ស្ពាន', 'pothole', 'hole', 'street'],
    'health' => ['សុខភាព', 'health', 'hospital', 'ពេទ្យ', 'clinic', 'disease', 'ជំងឺ', 'sick'],
    'environment' => ['បរិស្ថាន', 'environment', 'trash', 'សំរាម', 'pollution', 'ពុល', 'forest', 'ព្រៃ'],
  }.freeze

  URGENT_WORDS = ['emergency', 'urgent', 'ជាបន្ទាន់', 'ខ្ទេច', 'severe', 'critical', 'ធ្ងន់ធ្ងរ', 'die', 'dying', 'ស្លាប់'].freeze
  MEDIUM_WORDS = ['broken', 'ខូច', 'block', 'blocked', 'ស្ទះ', 'leak', 'ជ្រាប'].freeze

  def classify(description)
    text = description.to_s.downcase

    category = 'other'
    CATEGORY_KEYWORDS.each do |cat, words|
      if words.any? { |w| text.include?(w.downcase) }
        category = cat
        break
      end
    end

    priority = if URGENT_WORDS.any? { |w| text.include?(w.downcase) }
                 'High'
               elsif MEDIUM_WORDS.any? { |w| text.include?(w.downcase) }
                 'Medium'
               else
                 'Low'
               end

    { category: category, priority: priority }
  end

  # ---------- Views (pages) ----------

  get '/' do
    erb :index
  end

  get '/dashboard' do
    erb :dashboard
  end

  get '/authority' do
    erb :authority
  end

  # ---------- API: Stage 1 -> Stage 2 (submit + classify) ----------

  post '/api/issues' do
    payload = JSON.parse(request.body.read) rescue {}

    description = payload['description'].to_s.strip
    halt 400, json(error: 'ការពិពណ៌នាត្រូវការជាចាំបាច់ (description is required)') if description.empty?

    ai = classify(description)
    # allow client to override AI category if the user hand-picked one
    category = payload['category'].to_s.empty? ? ai[:category] : payload['category']
    priority = payload['priority'].to_s.empty? ? ai[:priority] : payload['priority']

    conn = db
    conn.execute(
      <<~SQL,
        INSERT INTO issues
          (reporter_name, description, category, priority, status,
           latitude, longitude, village, photo_data, input_method)
        VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)
      SQL
      [
        payload['reporter_name'],
        description,
        category,
        priority,
        payload['latitude'],
        payload['longitude'],
        payload['village'],
        payload['photo_data'],
        payload['input_method'] || 'text'
      ]
    )
    id = conn.last_insert_row_id
    conn.close

    json(id: id, category: category, priority: priority, status: 'Pending')
  end

  # ---------- API: Stage 3 (map & dashboard reads) ----------

  get '/api/issues' do
    conn = db
    query = 'SELECT * FROM issues WHERE 1=1'
    params = []

    if request.params['category'] && !request.params['category'].empty?
      query += ' AND category = ?'
      params << request.params['category']
    end
    if request.params['priority'] && !request.params['priority'].empty?
      query += ' AND priority = ?'
      params << request.params['priority']
    end
    if request.params['status'] && !request.params['status'].empty?
      query += ' AND status = ?'
      params << request.params['status']
    end

    query += ' ORDER BY CASE priority WHEN "High" THEN 0 WHEN "Medium" THEN 1 ELSE 2 END, created_at DESC'

    rows = conn.execute(query, params)
    conn.close
    json(rows)
  end

  get '/api/stats' do
    conn = db
    total = conn.execute('SELECT COUNT(*) as c FROM issues').first['c']
    by_status = conn.execute('SELECT status, COUNT(*) as c FROM issues GROUP BY status')
    by_category = conn.execute('SELECT category, COUNT(*) as c FROM issues GROUP BY category')
    by_priority = conn.execute('SELECT priority, COUNT(*) as c FROM issues GROUP BY priority')
    conn.close

    json(
      total: total,
      by_status: by_status,
      by_category: by_category,
      by_priority: by_priority
    )
  end

  # ---------- API: Stage 4 (authority actions) ----------

  patch '/api/issues/:id/status' do
    payload = JSON.parse(request.body.read) rescue {}
    new_status = payload['status']
    halt 400, json(error: 'ស្ថានភាពមិនត្រឹមត្រូវ (invalid status)') unless %w[Pending InProgress Resolved].include?(new_status&.gsub(' ', ''))

    conn = db
    conn.execute('UPDATE issues SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [new_status, params['id']])
    conn.close

    json(id: params['id'].to_i, status: new_status)
  end

  post '/api/issues/:id/feedback' do
    payload = JSON.parse(request.body.read) rescue {}
    message = payload['message'].to_s.strip
    halt 400, json(error: 'សារត្រូវការជាចាំបាច់') if message.empty?

    conn = db
    conn.execute('INSERT INTO feedback (issue_id, message) VALUES (?, ?)', [params['id'], message])
    conn.execute('UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [params['id']])
    conn.close

    json(ok: true)
  end

  get '/api/issues/:id/feedback' do
    conn = db
    rows = conn.execute('SELECT * FROM feedback WHERE issue_id = ? ORDER BY created_at ASC', [params['id']])
    conn.close
    json(rows)
  end

  run! if app_file == $0
end
