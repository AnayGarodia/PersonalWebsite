import numpy as np
import itertools
from collections import defaultdict

class PolygonAnalyzer:
    def __init__(self, n, tolerance=1e-6):
        self.n = n
        self.tol = tolerance
        self.points = []  # List of (x, y) coordinates
        self.adj = defaultdict(set)  # Graph: {point_idx: set(neighbor_indices)}
        self.faces = []  # List of faces (each face is a list of point indices)
        self.dual_adj = defaultdict(set) # Dual Graph: {face_idx: set(neighbor_face_indices)}
        
        print(f"--- Analyzing Regular {n}-gon ---")
        self._build_geometry()
        self._extract_faces()
        self._build_dual_graph()

    def _get_point_idx(self, p):
        """Finds existing point index or adds new one (handles floating point errors)."""
        # Linear search is slow but safe for N<30. For larger N, use spatial hash.
        for i, existing in enumerate(self.points):
            if np.linalg.norm(existing - p) < self.tol:
                return i
        self.points.append(p)
        return len(self.points) - 1

    def _build_geometry(self):
        print("1. calculating intersections...")
        # 1. Generate Vertices of N-gon
        vertices = [np.array([np.cos(2*np.pi*k/self.n), np.sin(2*np.pi*k/self.n)]) for k in range(self.n)]
        
        # 2. Define all Diagonals (lines)
        # We store lines as lists of point indices lying on them
        lines_points = [] 
        
        # Add all pairs of vertices (diagonals + edges)
        combos = list(itertools.combinations(range(self.n), 2))
        
        # Pre-fill lines with their endpoints
        # Note: We don't solve n^4 equations. We iterate lines and intersect them.
        # Optimization: We only care about intersections.
        
        # To handle "multiple lines at one point", we collect all intersections first
        # and then assign them to lines.
        
        # Actually, simpler robust approach:
        # 1. Add polygon vertices to our points list.
        for v in vertices:
            self.points.append(v) # indices 0 to n-1
            
        # 2. Intersect every pair of diagonals
        # This is O(N^4), acceptable for N < 25.
        raw_lines = []
        for u, v in combos:
            raw_lines.append((vertices[u], vertices[v], u, v))

        new_points_map = {} # Map geometric hash to index
        
        # Helper for line-line intersection
        def intersect(p1, p2, p3, p4):
            x1, y1 = p1; x2, y2 = p2
            x3, y3 = p3; x4, y4 = p4
            denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1)
            if abs(denom) < 1e-9: return None # Parallel
            ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom
            if 0 < ua < 1: # Strictly inside
                x = x1 + ua * (x2 - x1)
                y = y1 + ua * (y2 - y1)
                return np.array([x, y])
            return None

        # Collect points
        # For very accurate "clustering", we collect all candidates then merge.
        # But doing it on the fly is okay if we are careful.
        
        # To reconstruct the graph edges, we need to know which points lie on which line.
        # line_contents: index in raw_lines -> list of point_indices
        line_contents = defaultdict(list)
        
        # Initialize with endpoints
        for i, (p1, p2, u_idx, v_idx) in enumerate(raw_lines):
            line_contents[i].append(u_idx)
            line_contents[i].append(v_idx)
            
        print(f"   Intersecting {len(raw_lines)} lines (this may take a moment)...")
        for i in range(len(raw_lines)):
            for j in range(i + 1, len(raw_lines)):
                p1, p2, u1, v1 = raw_lines[i]
                p3, p4, u2, v2 = raw_lines[j]
                
                # Skip if they share a vertex endpoint
                if u1 in (u2, v2) or v1 in (u2, v2): continue
                
                pt = intersect(p1, p2, p3, p4)
                if pt is not None:
                    pid = self._get_point_idx(pt)
                    # Avoid duplicates on the same line
                    if pid not in line_contents[i]: line_contents[i].append(pid)
                    if pid not in line_contents[j]: line_contents[j].append(pid)

        # 3. Build Adjacency Graph from Lines
        print("2. Building graph edges...")
        for i in line_contents:
            # Sort points on the line by distance from one endpoint
            pts = line_contents[i]
            # Get coordinates
            coords = [self.points[pid] for pid in pts]
            # Project onto vector (p2 - p1)
            start_node = raw_lines[i][0]
            end_node = raw_lines[i][1]
            ref_vec = end_node - start_node
            
            # Sort by dot product
            # zip, sort, unzip
            sorted_pairs = sorted(zip(pts, coords), key=lambda x: np.dot(x[1] - start_node, ref_vec))
            sorted_pids = [p[0] for p in sorted_pairs]
            
            # Add edges
            for k in range(len(sorted_pids) - 1):
                u, v = sorted_pids[k], sorted_pids[k+1]
                if u == v: continue
                self.adj[u].add(v)
                self.adj[v].add(u)

    def _extract_faces(self):
        print("3. Extracting faces (regions)...")
        # Directed Edges traversal (Planar Graph Duality)
        # We look for the "tightest left turn" at every node.
        
        # Precompute angles for all edges
        adj_sorted = {}
        for u, neighbors in self.adj.items():
            u_pt = self.points[u]
            n_list = []
            for v in neighbors:
                v_pt = self.points[v]
                angle = np.arctan2(v_pt[1] - u_pt[1], v_pt[0] - u_pt[0])
                n_list.append((v, angle))
            # Sort by angle
            n_list.sort(key=lambda x: x[1])
            adj_sorted[u] = n_list

        visited_edges = set()
        
        for u in adj_sorted:
            for v, _ in adj_sorted[u]:
                if (u, v) in visited_edges: continue
                
                # Walk the face
                path = [u]
                curr, next_node = u, v
                
                while (curr, next_node) not in visited_edges:
                    visited_edges.add((curr, next_node))
                    path.append(next_node)
                    
                    # Find next edge: Incoming is (curr -> next_node)
                    # We need the edge outgoing from 'next_node' that is 
                    # immediately CCW (left) from the reversal of incoming.
                    
                    # Incoming angle at next_node
                    inc_vec = self.points[next_node] - self.points[curr]
                    inc_angle = np.arctan2(inc_vec[1], inc_vec[0])
                    # Reversing direction is +pi. But we want to turn left.
                    # We want the smallest angle > (inc_angle + pi)
                    
                    # Easier logic: Find 'curr' in next_node's sorted list.
                    # The entry BEFORE 'curr' in the sorted list is the sharpest left turn
                    # (assuming CCW ordering).
                    
                    neighbors = adj_sorted[next_node]
                    # Find index of curr
                    idx = -1
                    for k, (nbr, _) in enumerate(neighbors):
                        if nbr == curr:
                            idx = k
                            break
                    
                    # Determine next index (wrap around)
                    # If neighbors are sorted [-pi, pi], picking (idx-1) moves "clockwise" in the list 
                    # which corresponds to a Left Turn in coordinate space if we view angles correctly.
                    # Let's trust the (idx - 1) logic for CCW faces.
                    next_idx = (idx - 1) % len(neighbors)
                    w = neighbors[next_idx][0]
                    
                    curr, next_node = next_node, w
                    
                    if curr == u and next_node == v:
                        break
                
                if len(path) > 2:
                    # Filter out the "Outer" face
                    # The outer face usually has a huge area or opposite winding order.
                    # Simple heuristic: The outer face encloses the whole polygon.
                    # Its area is roughly Area(N-gon). Inner faces are small.
                    if self._calculate_area(path) < (0.5 * self.n * np.sin(2*np.pi/self.n) - 0.01):
                        self.faces.append(path)

    def _calculate_area(self, point_indices):
        # Shoelace formula
        area = 0.0
        for i in range(len(point_indices)):
            j = (i + 1) % len(point_indices)
            p1 = self.points[point_indices[i]]
            p2 = self.points[point_indices[j]]
            area += p1[0]*p2[1] - p2[0]*p1[1]
        return 0.5 * abs(area)

    def _build_dual_graph(self):
        # Two faces are connected if they share an edge (2 vertices)
        # Map edge_tuple -> list of face_indices
        edge_to_faces = defaultdict(list)
        
        for f_idx, path in enumerate(self.faces):
            for i in range(len(path)):
                u, v = path[i], path[(i+1)%len(path)]
                edge = tuple(sorted((u, v)))
                edge_to_faces[edge].append(f_idx)
                
        for edge, f_indices in edge_to_faces.items():
            if len(f_indices) == 2:
                f1, f2 = f_indices
                self.dual_adj[f1].add(f2)
                self.dual_adj[f2].add(f1)

    # --- RESULTS FUNCTIONS ---

    def get_Pi(self):
        """Returns dictionary {number_of_sides: count}"""
        stats = defaultdict(int)
        for face in self.faces:
            sides = len(face) - 1
            stats[sides] += 1
        return dict(sorted(stats.items()))

    def get_Ri(self, k):
        """Returns count of connected regions of size k (R_k)"""
        if k == 1: return len(self.faces)
        
        # Enumerate connected subgraphs of size k
        # This is a graph theory problem. For k=2, 3, 4 it's easy.
        
        # R_2: Number of edges in dual graph
        if k == 2:
            count = 0
            for u in self.dual_adj:
                count += len(self.dual_adj[u])
            return count // 2 # Each edge counted twice
            
        # R_3: Three connected nodes
        # Shapes: Line (A-B-C) or Triangle (A-B, B-C, C-A)
        # We can just DFS from every node up to depth k, storing sorted tuples to avoid duplicates.
        
        found_subgraphs = set()
        
        # Optimized recursion
        def find_connected(current_nodes, candidates):
            # current_nodes: set of nodes in current subgraph
            # candidates: set of neighbors of current_nodes not in current_nodes
            
            if len(current_nodes) == k:
                found_subgraphs.add(tuple(sorted(current_nodes)))
                return
            
            # Optimization: Prune if we can't reach k?
            # Pick a candidate
            # To avoid duplicates, we can enforce order, but set logic is easier for small k
            
            sorted_cands = sorted(list(candidates)) # Deterministic order
            for node in sorted_cands:
                # Create new candidates: (old_candidates - node) + (new_neighbors - current - old)
                new_cands = candidates.copy()
                new_cands.remove(node)
                
                # Add valid neighbors
                for nbr in self.dual_adj[node]:
                    if nbr not in current_nodes and nbr not in candidates: 
                        # Optimization: To avoid re-generating the same set via different paths,
                        # we can enforce that we only add nodes > min(current_nodes)??
                        # Standard enumeration trick: only add v if v > start_node
                        pass
                        new_cands.add(nbr)
                
                # Recurse
                new_nodes = current_nodes | {node}
                # Check if we already found this exact set (optional optimization)
                # This naive recursion is expensive. 
                # Better: Iterate all nodes as 'start', only expand to higher indices? 
                # Let's stick to the set `found_subgraphs` to dedup at the end.
                find_connected(new_nodes, new_cands)

        # This is still slow. Let's do simple brute force for k=3,4 on the graph structure.
        nodes = list(self.dual_adj.keys())
        
        if k == 3:
            # Pattern: A-B-C.
            # Iterate edges A-B. Then for neighbor C of A or B...
            # This is much faster.
            count = 0
            for u in nodes:
                for v in self.dual_adj[u]:
                    if v < u: continue # undirected edge handled once
                    # We have A-B. Now find C.
                    # Neighbors of u (excluding v)
                    for w in self.dual_adj[u]:
                        if w != v:
                            found_subgraphs.add(tuple(sorted((u, v, w))))
                    # Neighbors of v (excluding u)
                    for w in self.dual_adj[v]:
                        if w != u:
                            found_subgraphs.add(tuple(sorted((u, v, w))))
            return len(found_subgraphs)

        if k == 4:
            # Similar expansion from size 3
            # First get all size 3
            r3_sets = set()
            # ... (reuse logic above to populate r3_sets)
            # Just use the generic DFS but optimized
            pass 
        
        # Generic fallback for k=4 (reasonably fast for N<20)
        # Using the standard "generate all connected subgraphs" algorithm is complex.
        # Let's just do a limited BFS from each node.
        
        final_sets = set()
        for start_node in nodes:
            queue = [( {start_node}, self.dual_adj[start_node] )] # (current_set, potential_neighbors)
            while queue:
                curr, cands = queue.pop(0)
                if len(curr) == k:
                    final_sets.add(tuple(sorted(list(curr))))
                    continue
                
                # Expand
                # To prevent explosion, only add nodes > min(curr) ?? No, graph connectivity is complex.
                # Just limit by index > start_node to prevent duplicates?
                # Only explore paths where ALL nodes are >= start_node.
                
                valid_cands = [x for x in cands if x > start_node and x not in curr]
                
                for next_node in valid_cands:
                    new_set = curr | {next_node}
                    new_cands = cands | self.dual_adj[next_node]
                    queue.append((new_set, new_cands))
                    
        return len(final_sets)

# --- EXAMPLE USAGE ---

# Analyze a Decagon (N=10)
# Warning: N=15 takes a few seconds. N=20 takes longer.
poly = PolygonAnalyzer(25)

print("\n--- RESULTS ---")
print("P_i (Region Shapes):", poly.get_Pi())
print("R_1 (Total Regions):", poly.get_Ri(1))
print("R_2 (Pairs):", poly.get_Ri(2))
print("R_3 (Triplets):", poly.get_Ri(3))
print("R_4 (Quadruplets):", poly.get_Ri(4))