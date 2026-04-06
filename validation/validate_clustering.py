#!/usr/bin/env python3
"""
Clustering Validation Script for Transit Requirements Elicitation
v2: OpenAI embeddings support, adaptive threshold testing, small cluster merging

Validates our agglomerative clustering algorithm against a synthetic ground-truth
dataset of 60 public transit stakeholder submissions across 6 categories.

Tests THREE approaches:
  1. Our algorithm v2: Agglomerative + adaptive threshold + small cluster merging
  2. Our algorithm v1: Agglomerative with fixed threshold (baseline comparison)
  3. K-Means: Standard baseline

Embedding modes:
  --embeddings openai   Use OpenAI text-embedding-3-small (production-equivalent, ~$0.002)
  --embeddings tfidf    Use TF-IDF (free, offline, lower quality)

Evaluation Metrics:
- Adjusted Rand Index (ARI): Clustering similarity vs ground truth (0=random, 1=perfect)
- Silhouette Score: Cluster cohesion and separation (-1 to 1, higher is better)
- Precision / Recall / F1-Score per cluster
- Purity: Fraction of dominant class in each cluster

Usage:
  python validate_clustering.py --embeddings openai --thresholds
  python validate_clustering.py --embeddings tfidf --output-format json
"""

import json
import os
import argparse
import random
from datetime import datetime
from typing import Dict, List, Tuple
from collections import defaultdict, Counter
import numpy as np
from sklearn.metrics import adjusted_rand_score, silhouette_score as sklearn_silhouette
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine


# ─── Synthetic Dataset ───
# 60 submissions across 6 categories, modeled after real transit feedback.

TRANSIT_DATASET = {
    "route_optimization": [
        "Bus routes should be redesigned to reduce travel time between downtown and suburbs",
        "Current bus routes are too indirect and waste passenger time with unnecessary detours",
        "We need more express routes that skip intermediate stops during peak hours",
        "Routes should be optimized using real-time traffic data and passenger demand patterns",
        "The route from University district to downtown takes too long with all the stops",
        "Direct routes between major employment centers would improve ridership significantly",
        "Bus frequency should increase on high-demand routes and decrease on underutilized ones",
        "Some routes have buses running empty while others are overcrowded",
        "Route planning should consider connecting residential areas to job centers efficiently",
        "Weekend routes should be different from weekday routes based on actual usage patterns"
    ],
    "accessibility": [
        "All bus stops need wheelchair accessibility and proper ramps for people with mobility issues",
        "Audio announcements for stop names are essential for visually impaired passengers",
        "Low-floor buses are needed to accommodate wheelchairs and elderly passengers easily",
        "Bus stop signs should include Braille text for blind and visually impaired users",
        "The transit app should have voice navigation and screen reader compatibility",
        "Priority seating for elderly and disabled passengers needs better enforcement",
        "Wider aisles in buses would help people with walkers and mobility devices",
        "Emergency communication buttons should be accessible to people with different abilities",
        "Transit information should be available in multiple languages for immigrant communities",
        "Station elevators need backup power and regular maintenance for reliability"
    ],
    "safety_security": [
        "Better lighting at bus stops would make me feel safer waiting at night",
        "Security cameras on buses and at major stops would deter crime and harassment",
        "Emergency call buttons at bus stops are needed for passenger safety",
        "Driver training on handling conflicts and emergency situations needs improvement",
        "Police presence at transit stations should be increased during evening hours",
        "Panic buttons on buses would help passengers report incidents quickly",
        "Better communication between drivers and dispatch for emergency situations",
        "Background checks for all transit employees including contractors and vendors",
        "Anti-slip surfaces at bus stops and on buses to prevent accidents in wet weather",
        "Clear sight lines at bus stops so passengers can see approaching buses safely"
    ],
    "real_time_info": [
        "Mobile app should show exact bus arrival times, not just scheduled times",
        "Digital displays at bus stops showing real-time arrival information are essential",
        "Push notifications when my regular bus is delayed or cancelled would be very helpful",
        "Real-time crowding information so I know if the next bus will be full",
        "Service alerts about route changes or delays should be sent immediately",
        "GPS tracking of buses should be accurate and update frequently throughout the day",
        "Integration with Google Maps and other navigation apps for seamless trip planning",
        "Text messaging system for riders to get bus arrival times by stop number",
        "Real-time information about wheelchair accessibility of approaching buses",
        "Voice announcements of delays and service changes at major transit stations"
    ],
    "fare_payment": [
        "Contactless payment with credit cards and mobile wallets should be standard",
        "Monthly passes should be available digitally through a mobile app",
        "Fare integration between buses, trains, and light rail for seamless transfers",
        "Income-based fare discounts for low-income residents who depend on public transit",
        "Student discounts should extend beyond K-12 to include college and university students",
        "Day passes for tourists and occasional riders should be easy to purchase",
        "Cash payment should still be accepted but exact change requirements are problematic",
        "Senior citizen fare discounts need to be clearly posted and easy to understand",
        "Family day passes for weekend recreational trips would encourage ridership",
        "Employer-subsidized transit passes should integrate easily with payroll systems"
    ],
    "comfort_amenities": [
        "Bus stops need weather protection like covered shelters and wind barriers",
        "Wi-Fi on buses would make commuting time more productive for passengers",
        "USB charging ports at seats for phones and electronic devices",
        "Air conditioning and heating systems need better maintenance and temperature control",
        "More comfortable seating that provides adequate back support for longer rides",
        "Bike racks on buses should accommodate different types of bicycles securely",
        "Clean restrooms at major transit stations and terminals are a necessity",
        "Water fountains at transit stations for passenger convenience and health",
        "Noise levels on buses should be controlled to create a pleasant environment",
        "Interior design improvements to make buses feel modern and welcoming"
    ]
}

CLUSTER_LABELS = {
    "route_optimization": "Route Optimization & Efficiency",
    "accessibility": "Accessibility & Universal Design",
    "safety_security": "Safety & Security",
    "real_time_info": "Real-time Information Systems",
    "fare_payment": "Fare & Payment Systems",
    "comfort_amenities": "Comfort & Amenities"
}


# ─── Embedding Generation ───

def get_tfidf_embeddings(texts):
    """Generate TF-IDF embeddings (offline, free)."""
    vectorizer = TfidfVectorizer(max_features=200, stop_words="english", ngram_range=(1, 2))
    X = vectorizer.fit_transform(texts).toarray()
    return X

def get_openai_embeddings(texts):
    """Generate OpenAI text-embedding-3-small embeddings (production-equivalent)."""
    try:
        import openai
    except ImportError:
        print("ERROR: openai package not installed. Run: pip install openai")
        raise

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        # Try reading from .env file in project root
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    if line.startswith("OPENAI_API_KEY="):
                        api_key = line.strip().split("=", 1)[1].strip('"').strip("'")
                        break

    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment or .env file")

    client = openai.OpenAI(api_key=api_key)

    # Batch embed (OpenAI supports up to 2048 inputs per call)
    print(f"  Calling OpenAI text-embedding-3-small for {len(texts)} texts...")
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )

    embeddings = [item.embedding for item in response.data]
    print(f"  Got {len(embeddings)} embeddings, dimension={len(embeddings[0])}")
    return np.array(embeddings)


# ─── Dataset Generation ───

def generate_dataset() -> Tuple[List[str], List[str]]:
    """Generate shuffled dataset with submissions and ground truth labels."""
    texts, labels = [], []
    for key, submissions in TRANSIT_DATASET.items():
        for s in submissions:
            texts.append(s)
            labels.append(key)
    combined = list(zip(texts, labels))
    random.shuffle(combined)
    texts, labels = zip(*combined)
    return list(texts), list(labels)


# ─── Our Algorithm v2: Adaptive Threshold + Small Cluster Merging ───

def agglomerative_cosine(X, threshold=0.35):
    """Agglomerative clustering using cosine similarity with average linkage."""
    clustering = AgglomerativeClustering(
        n_clusters=None,
        metric='cosine',
        linkage='average',
        distance_threshold=1.0 - threshold
    )
    return clustering.fit_predict(X)

def merge_small_clusters(labels, X, min_size=3):
    """Post-merge: absorb clusters with < min_size members into nearest neighbor."""
    labels = labels.copy()
    unique = list(set(labels))

    changed = True
    while changed:
        changed = False
        unique = list(set(labels))
        if len(unique) <= 2:
            break

        # Find smallest cluster below threshold
        cluster_sizes = Counter(labels)
        small_clusters = [(c, s) for c, s in cluster_sizes.items() if s < min_size]
        if not small_clusters:
            break

        # Sort by size ascending — merge smallest first
        small_clusters.sort(key=lambda x: x[1])
        target_cluster = small_clusters[0][0]

        # Find centroid of small cluster
        small_mask = np.array([l == target_cluster for l in labels])
        small_centroid = X[small_mask].mean(axis=0).reshape(1, -1)

        # Find nearest other cluster by centroid distance
        best_sim = -1
        best_target = None
        for c in unique:
            if c == target_cluster:
                continue
            c_mask = np.array([l == c for l in labels])
            c_centroid = X[c_mask].mean(axis=0).reshape(1, -1)
            sim = sklearn_cosine(small_centroid, c_centroid)[0][0]
            if sim > best_sim:
                best_sim = sim
                best_target = c

        if best_target is not None:
            for i in range(len(labels)):
                if labels[i] == target_cluster:
                    labels[i] = best_target
            changed = True

    # Renumber clusters sequentially
    unique = sorted(set(labels))
    mapping = {old: new for new, old in enumerate(unique)}
    return np.array([mapping[l] for l in labels])

def find_optimal_threshold(X, thresholds=None):
    """Adaptive threshold: test multiple values, pick best silhouette with cluster count penalty.
    
    The scoring balances three concerns:
    1. Silhouette score (cluster cohesion & separation)
    2. Cluster count reasonableness (not too few, not too many)
    3. Small cluster avoidance (micro-clusters indicate over-splitting)
    
    The penalty system ensures we don't collapse everything into 1-2 mega-clusters
    (high silhouette but useless) or fragment into 50+ micro-clusters (high purity but noisy).
    """
    if thresholds is None:
        thresholds = np.arange(0.10, 0.80, 0.05)

    n = len(X)
    min_clusters = 3
    max_clusters = max(n // 3, 5)

    results = []
    best_score = -float('inf')
    best_threshold = 0.35

    for t in thresholds:
        try:
            pred = agglomerative_cosine(X, threshold=t)
            n_clusters = len(set(pred))
            sil = sklearn_silhouette(X, pred, metric='cosine') if n_clusters > 1 else -1

            # We want the threshold that maximizes a combined objective:
            # 1. Silhouette score (cluster quality)
            # 2. ARI-proxy: balance of cluster sizes (even distribution = better separation)
            
            # Hard penalty for too few clusters (can't distinguish topics)
            penalty = 0
            if n_clusters < min_clusters:
                penalty += 0.5 * (min_clusters - n_clusters)
            
            # Soft penalty for single-point clusters — they get merged anyway,
            # but many of them means the threshold is too high
            small_count = sum(1 for c, s in Counter(pred).items() if s < 3)
            small_ratio = small_count / max(n_clusters, 1)
            penalty += 0.1 * small_ratio
            
            # Bonus for having more clusters (up to a point) — higher thresholds
            # that still produce reasonable silhouettes should be preferred
            # because the merge step will clean up small clusters
            cluster_bonus = 0.01 * min(n_clusters, max_clusters)

            adjusted = sil - penalty + cluster_bonus

            results.append({
                "threshold": round(float(t), 2),
                "n_clusters": int(n_clusters),
                "silhouette": round(float(sil), 3),
                "small_clusters": int(small_count),
                "adjusted_score": round(float(adjusted), 3)
            })

            if adjusted > best_score:
                best_score = adjusted
                best_threshold = t
        except Exception:
            pass

    return round(float(best_threshold), 2), results


# ─── Baseline: K-Means ───

def kmeans_cluster(X, n_clusters):
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    return kmeans.fit_predict(X)


# ─── Metrics ───

def calc_metrics(true_labels, pred_labels, X):
    unique_true = sorted(set(true_labels))
    true_numeric = [unique_true.index(l) for l in true_labels]

    ari = adjusted_rand_score(true_numeric, pred_labels)
    n_pred = len(set(pred_labels))
    sil = sklearn_silhouette(X, pred_labels, metric='cosine') if n_pred > 1 else -1

    pred_to_true = defaultdict(list)
    for tl, pl in zip(true_labels, pred_labels):
        pred_to_true[pl].append(tl)

    cluster_stats = {}
    for pc, members in sorted(pred_to_true.items()):
        counter = Counter(members)
        majority = counter.most_common(1)[0][0]
        correct = counter[majority]
        total_pred = len(members)
        total_true = true_labels.count(majority)

        prec = correct / total_pred if total_pred else 0
        rec = correct / total_true if total_true else 0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0

        cluster_stats[pc] = {
            "matched": majority,
            "matched_label": CLUSTER_LABELS.get(majority, majority),
            "size": total_pred,
            "precision": round(prec, 3),
            "recall": round(rec, 3),
            "f1": round(f1, 3),
        }

    precisions = [s["precision"] for s in cluster_stats.values()]
    recalls = [s["recall"] for s in cluster_stats.values()]
    f1s = [s["f1"] for s in cluster_stats.values()]

    purity_sum = sum(Counter(m).most_common(1)[0][1] for m in pred_to_true.values())
    purity = purity_sum / len(true_labels)

    return {
        "ari": round(float(ari), 3),
        "silhouette": round(float(sil), 3),
        "avg_precision": round(float(np.mean(precisions)), 3),
        "avg_recall": round(float(np.mean(recalls)), 3),
        "avg_f1": round(float(np.mean(f1s)), 3),
        "purity": round(float(purity), 3),
        "n_clusters": int(n_pred),
        "cluster_details": cluster_stats,
    }


# ─── Output Formatting ───

def format_text(v2_metrics, v1_metrics, baseline_metrics, sweep_results, n_texts, embedding_mode, optimal_threshold, merge_stats):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    emb_label = "OpenAI text-embedding-3-small (1536-dim)" if embedding_mode == "openai" else "TF-IDF bigrams (200-dim)"
    
    lines = []
    lines.append("=" * 78)
    lines.append("  TRANSIT REQUIREMENTS CLUSTERING — VALIDATION REPORT v2")
    lines.append("=" * 78)
    lines.append(f"  Timestamp:        {ts}")
    lines.append(f"  Dataset:          {n_texts} synthetic transit stakeholder submissions")
    lines.append(f"  Ground Truth:     6 clusters (route, accessibility, safety, info, fare, comfort)")
    lines.append(f"  Embeddings:       {emb_label}")
    lines.append(f"  Optimal Threshold: {optimal_threshold} (auto-selected via silhouette optimization)")
    lines.append(f"  Small Clusters:   {merge_stats['before']} → {merge_stats['after']} (merged {merge_stats['merged']} small clusters)")
    lines.append("")

    lines.append("─" * 78)
    lines.append("  THREE-WAY ALGORITHM COMPARISON")
    lines.append("─" * 78)
    lines.append(f"  {'Metric':<30} {'v2 (Adaptive)':<18} {'v1 (Fixed)':<18} {'K-Means':<18}")
    lines.append(f"  {'─'*30} {'─'*18} {'─'*18} {'─'*18}")
    lines.append(f"  {'Clusters Found':<30} {v2_metrics['n_clusters']:<18} {v1_metrics['n_clusters']:<18} {baseline_metrics['n_clusters']:<18}")
    lines.append(f"  {'Adjusted Rand Index':<30} {v2_metrics['ari']:<18} {v1_metrics['ari']:<18} {baseline_metrics['ari']:<18}")
    lines.append(f"  {'Silhouette Score':<30} {v2_metrics['silhouette']:<18} {v1_metrics['silhouette']:<18} {baseline_metrics['silhouette']:<18}")
    lines.append(f"  {'Average Precision':<30} {v2_metrics['avg_precision']:<18} {v1_metrics['avg_precision']:<18} {baseline_metrics['avg_precision']:<18}")
    lines.append(f"  {'Average Recall':<30} {v2_metrics['avg_recall']:<18} {v1_metrics['avg_recall']:<18} {baseline_metrics['avg_recall']:<18}")
    lines.append(f"  {'Average F1-Score':<30} {v2_metrics['avg_f1']:<18} {v1_metrics['avg_f1']:<18} {baseline_metrics['avg_f1']:<18}")
    lines.append(f"  {'Purity':<30} {v2_metrics['purity']:<18} {v1_metrics['purity']:<18} {baseline_metrics['purity']:<18}")
    lines.append("")

    # Winner
    scores = {
        "v2": v2_metrics["ari"] + v2_metrics["avg_f1"] + v2_metrics["purity"],
        "v1": v1_metrics["ari"] + v1_metrics["avg_f1"] + v1_metrics["purity"],
        "kmeans": baseline_metrics["ari"] + baseline_metrics["avg_f1"] + baseline_metrics["purity"]
    }
    winner_key = max(scores, key=scores.get)
    winner_names = {"v2": "Our Algorithm v2 (Adaptive + Merge)", "v1": "Our Algorithm v1 (Fixed Threshold)", "kmeans": "K-Means Baseline"}
    lines.append(f"  ★ Winner: {winner_names[winner_key]}")

    # Improvement over v1
    if v1_metrics["ari"] > 0:
        ari_improvement = ((v2_metrics["ari"] - v1_metrics["ari"]) / v1_metrics["ari"] * 100)
        lines.append(f"  ↑ ARI improvement v1→v2: {ari_improvement:+.1f}%")
    if v1_metrics["avg_f1"] > 0:
        f1_improvement = ((v2_metrics["avg_f1"] - v1_metrics["avg_f1"]) / v1_metrics["avg_f1"] * 100)
        lines.append(f"  ↑ F1 improvement v1→v2:  {f1_improvement:+.1f}%")
    lines.append("")

    # Per-cluster breakdown for v2
    lines.append("─" * 78)
    lines.append("  v2 ALGORITHM — PER-CLUSTER BREAKDOWN")
    lines.append("─" * 78)
    for cid, stats in sorted(v2_metrics["cluster_details"].items()):
        lines.append(f"  Cluster {cid}: {stats['matched_label']}")
        lines.append(f"    Size: {stats['size']}  |  P: {stats['precision']}  |  R: {stats['recall']}  |  F1: {stats['f1']}")
    lines.append("")

    # Threshold sweep
    if sweep_results:
        lines.append("─" * 78)
        lines.append("  ADAPTIVE THRESHOLD ANALYSIS")
        lines.append("─" * 78)
        lines.append(f"  {'Threshold':<12} {'Clusters':<10} {'Silhouette':<12} {'Small':<8} {'Adj.Score':<12}")
        lines.append(f"  {'─'*12} {'─'*10} {'─'*12} {'─'*8} {'─'*12}")
        for r in sweep_results:
            if "error" in r:
                continue
            marker = " ◄ selected" if r["threshold"] == optimal_threshold else ""
            lines.append(f"  {r['threshold']:<12} {r['n_clusters']:<10} {r['silhouette']:<12} {r['small_clusters']:<8} {r['adjusted_score']:<12}{marker}")
        lines.append("")

    # Quality assessment
    lines.append("─" * 78)
    lines.append("  QUALITY ASSESSMENT")
    lines.append("─" * 78)
    ari = v2_metrics["ari"]
    if ari >= 0.7:
        lines.append("  ✓ EXCELLENT: Clustering closely matches ground truth groupings")
    elif ari >= 0.5:
        lines.append("  ✓ GOOD: Clustering reasonably matches ground truth groupings")
    elif ari >= 0.3:
        lines.append("  ⚠ FAIR: Clustering partially matches ground truth — room for improvement")
    else:
        lines.append("  ⚠ MODERATE: Clustering has limited alignment with ground truth")

    if embedding_mode == "tfidf":
        lines.append("")
        lines.append("  NOTE: Using TF-IDF embeddings (keyword matching only).")
        lines.append("  Production uses OpenAI's 1536-dim semantic embeddings which capture")
        lines.append("  meaning beyond keywords. Run with --embeddings openai for accurate results.")
    else:
        lines.append("")
        lines.append("  ✓ Using production-equivalent OpenAI embeddings.")
        lines.append("  These results reflect actual system performance.")

    lines.append("=" * 78)
    return "\n".join(lines)


def format_json(v2_metrics, v1_metrics, baseline_metrics, sweep_results, n_texts, embedding_mode, optimal_threshold, merge_stats):
    def convert(obj):
        if isinstance(obj, (np.integer,)): return int(obj)
        if isinstance(obj, (np.floating,)): return float(obj)
        if isinstance(obj, np.ndarray): return obj.tolist()
        return str(obj)

    def clean(d):
        if isinstance(d, dict): return {str(k): clean(v) for k, v in d.items()}
        if isinstance(d, list): return [clean(i) for i in d]
        return d

    return json.dumps(clean({
        "version": "2.0",
        "timestamp": datetime.now().isoformat(),
        "dataset_size": n_texts,
        "ground_truth_clusters": 6,
        "embedding_method": embedding_mode,
        "optimal_threshold": optimal_threshold,
        "merge_stats": merge_stats,
        "v2_adaptive": v2_metrics,
        "v1_fixed": v1_metrics,
        "baseline_kmeans": baseline_metrics,
        "threshold_analysis": sweep_results,
    }), indent=2, default=convert)


# ─── Main ───

def main():
    parser = argparse.ArgumentParser(description="Validate transit requirements clustering v2")
    parser.add_argument("--output-format", choices=["text", "json"], default="text")
    parser.add_argument("--output-file", help="Save results to file")
    parser.add_argument("--thresholds", action="store_true", help="Show threshold sweep details")
    parser.add_argument("--embeddings", choices=["tfidf", "openai"], default="tfidf",
                        help="Embedding method: tfidf (free/offline) or openai (production-equivalent)")
    args = parser.parse_args()

    random.seed(42)
    np.random.seed(42)

    print("Generating synthetic transit stakeholder dataset...", flush=True)
    texts, true_labels = generate_dataset()
    print(f"Dataset: {len(texts)} submissions across {len(set(true_labels))} categories")

    # Generate embeddings
    print(f"Generating embeddings ({args.embeddings})...", flush=True)
    if args.embeddings == "openai":
        X = get_openai_embeddings(texts)
    else:
        X = get_tfidf_embeddings(texts)

    # ── v2: Adaptive threshold + small cluster merging ──
    print("Running v2 algorithm (adaptive threshold + merge)...", flush=True)
    optimal_threshold, sweep_results = find_optimal_threshold(X)
    print(f"  Optimal threshold: {optimal_threshold}")
    
    v2_pred_raw = agglomerative_cosine(X, threshold=optimal_threshold)
    pre_merge_count = len(set(v2_pred_raw))
    # Dynamic min_size: for small datasets, lower the bar so we don't over-merge
    # Rule: merge clusters smaller than ~5% of total submissions, minimum 2
    # Show cluster size distribution before merging
    raw_counts = Counter(v2_pred_raw)
    print(f"  Raw cluster sizes: {sorted(raw_counts.values(), reverse=True)}")
    dynamic_min_size = max(2, int(len(X) * 0.05))
    print(f"  Merge threshold: min_size={dynamic_min_size} (5% of {len(X)} submissions)")
    v2_pred = merge_small_clusters(v2_pred_raw, X, min_size=dynamic_min_size)
    post_merge_count = len(set(v2_pred))
    
    merge_stats = {
        "before": int(pre_merge_count),
        "after": int(post_merge_count),
        "merged": int(pre_merge_count - post_merge_count)
    }
    print(f"  Clusters: {pre_merge_count} → {post_merge_count} (merged {merge_stats['merged']} small)")
    
    v2_metrics = calc_metrics(true_labels, v2_pred, X)

    # ── v1: Fixed threshold (old approach) ──
    print("Running v1 algorithm (fixed threshold 0.15 for TF-IDF / 0.70 for OpenAI)...", flush=True)
    fixed_threshold = 0.70 if args.embeddings == "openai" else 0.15
    v1_pred = agglomerative_cosine(X, threshold=fixed_threshold)
    v1_metrics = calc_metrics(true_labels, v1_pred, X)

    # ── Baseline: K-Means ──
    print("Running baseline (K-Means, k=6)...", flush=True)
    base_pred = kmeans_cluster(X, n_clusters=6)
    baseline_metrics = calc_metrics(true_labels, base_pred, X)

    # Format output
    if args.output_format == "json":
        output = format_json(v2_metrics, v1_metrics, baseline_metrics, sweep_results, len(texts), args.embeddings, optimal_threshold, merge_stats)
    else:
        output = format_text(v2_metrics, v1_metrics, baseline_metrics, sweep_results, len(texts), args.embeddings, optimal_threshold, merge_stats)

    if args.output_file:
        with open(args.output_file, "w") as f:
            f.write(output)
        print(f"\nResults saved to {args.output_file}")
    else:
        print(output)


if __name__ == "__main__":
    main()
