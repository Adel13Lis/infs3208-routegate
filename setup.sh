#!/bin/bash

# This script performs the complete setup: GKE cluster creation, Docker image building, and deployment

set -e 

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}RouteGate - Complete Setup...${NC}"
echo
echo "This script will:"
echo "  1. Create a GKE cluster"
echo "  2. Build and push Docker images to GCR"
echo "  3. Deploy the application to Kubernetes"
echo

if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID environment variable is not set${NC}"
    echo "Please set it with: export GCP_PROJECT_ID=your-project-id"
    exit 1
fi

CLUSTER_NAME="${CLUSTER_NAME:-routegate-cluster}"
ZONE="${ZONE:-us-central1-a}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-medium}"
NUM_NODES="${NUM_NODES:-3}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Project ID: $GCP_PROJECT_ID"
echo "  Cluster Name: $CLUSTER_NAME"
echo "  Zone: $ZONE"
echo "  Machine Type: $MACHINE_TYPE"
echo "  Number of Nodes: $NUM_NODES"
echo
echo -e "${YELLOW}Note: You can override these defaults by setting environment variables before running this script${NC}"
echo "Example: export CLUSTER_NAME=my-cluster ZONE=us-east1-b"
echo

read -p "Do you want to proceed with this configuration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi


echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Creating GKE Cluster${NC}"
echo -e "${GREEN}========================================${NC}"
echo

gcloud config set project $GCP_PROJECT_ID
gcloud services enable container.googleapis.com
gcloud services enable containerregistry.googleapis.com

gcloud container clusters create $CLUSTER_NAME \
    --zone $ZONE \
    --num-nodes $NUM_NODES \
    --machine-type $MACHINE_TYPE \
    --disk-size 20 \
    --enable-autoscaling \
    --min-nodes 2 \
    --max-nodes 5 \
    --enable-autorepair \
    --enable-autoupgrade \
    --addons HorizontalPodAutoscaling,HttpLoadBalancing \
    --scopes "https://www.googleapis.com/auth/cloud-platform"

echo -e "${GREEN}GKE cluster created successfully${NC}"
echo

gcloud container clusters get-credentials $CLUSTER_NAME --zone $ZONE

echo
echo -e "${BLUE}Cluster Information:${NC}"
kubectl cluster-info
echo
echo -e "${BLUE}Nodes:${NC}"
kubectl get nodes
echo


echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Building Docker Images${NC}"
echo -e "${GREEN}========================================${NC}"
echo

gcloud auth configure-docker --quiet

# Build API Service
echo -e "${YELLOW}[1/3] Building API Service...${NC}"
docker build -t gcr.io/${GCP_PROJECT_ID}/api-service:v1 \
    -t gcr.io/${GCP_PROJECT_ID}/api-service:latest \
    ./api-service
echo -e "${GREEN}API Service built successfully${NC}"
echo

# Build Weather Service
echo -e "${YELLOW}[2/3] Building Weather Service...${NC}"
docker build -t gcr.io/${GCP_PROJECT_ID}/weather-service:v1 \
    -t gcr.io/${GCP_PROJECT_ID}/weather-service:latest \
    ./weather-service
echo -e "${GREEN}Weather Service built successfully${NC}"
echo

# Build Frontend
echo -e "${YELLOW}[3/3] Building Frontend...${NC}"
docker build -t gcr.io/${GCP_PROJECT_ID}/frontend:v1 \
    -t gcr.io/${GCP_PROJECT_ID}/frontend:latest \
    ./frontend
echo -e "${GREEN}Frontend built successfully${NC}"
echo

echo -e "${GREEN}Pushing Images to GCR...${NC}"
echo

# Push API Service
echo -e "${YELLOW}[1/3] Pushing API Service...${NC}"
docker push gcr.io/${GCP_PROJECT_ID}/api-service:v1
docker push gcr.io/${GCP_PROJECT_ID}/api-service:latest
echo -e "${GREEN}API Service pushed successfully${NC}"
echo

# Push Weather Service
echo -e "${YELLOW}[2/3] Pushing Weather Service...${NC}"
docker push gcr.io/${GCP_PROJECT_ID}/weather-service:v1
docker push gcr.io/${GCP_PROJECT_ID}/weather-service:latest
echo -e "${GREEN}Weather Service pushed successfully${NC}"
echo

# Push Frontend
echo -e "${YELLOW}[3/3] Pushing Frontend...${NC}"
docker push gcr.io/${GCP_PROJECT_ID}/frontend:v1
docker push gcr.io/${GCP_PROJECT_ID}/frontend:latest
echo -e "${GREEN}Frontend pushed successfully${NC}"
echo

echo -e "${GREEN}All images have been built and pushed to GCR${NC}"
echo

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying to Kubernetes${NC}"
echo -e "${GREEN}========================================${NC}"
echo

# Create temporary directory for processed manifests
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo -e "${YELLOW}Preparing Kubernetes manifests...${NC}"

# Process each manifest file and replace GCP_PROJECT_ID
for file in k8s/*.yaml; do
    filename=$(basename "$file")
    envsubst < "$file" > "$TMP_DIR/$filename"
    echo "  Processed $filename"
done

echo
echo -e "${GREEN}Deploying to Kubernetes...${NC}"
echo

# Step 1: MySQL PersistentVolume and Secret
echo -e "${YELLOW}[1/7] Creating MySQL PersistentVolume and Secret...${NC}"
kubectl apply -f "$TMP_DIR/1-mysql-pv.yaml"
echo -e "${GREEN}MySQL PV and Secret created${NC}"
sleep 2
echo

# Step 2: MySQL Deployment
echo -e "${YELLOW}[2/7] Deploying MySQL...${NC}"
kubectl apply -f "$TMP_DIR/2-mysql-deployment.yaml"
kubectl wait --for=condition=ready pod -l app=mysql --timeout=300s || {
    echo -e "${RED}MySQL pod failed to become ready${NC}"
    kubectl get pods -l app=mysql
    kubectl logs -l app=mysql --tail=50
    exit 1
}
echo -e "${GREEN}MySQL is ready${NC}"
sleep 5
echo

# Step 3: Initialize Database
echo -e "${YELLOW}[3/7] Initializing Database...${NC}"
kubectl apply -f "$TMP_DIR/3-init-db-job.yaml"
kubectl wait --for=condition=complete job/init-db --timeout=300s || {
    echo -e "${RED}Database initialization job failed${NC}"
    kubectl logs job/init-db --tail=100
    exit 1
}
echo -e "${GREEN}Database initialized successfully${NC}"
echo

# Step 4: Deploy Weather Service
echo -e "${YELLOW}[4/7] Deploying Weather Service...${NC}"
kubectl apply -f "$TMP_DIR/4-weather-deployment.yaml"
kubectl wait --for=condition=available deployment/weather-service --timeout=180s
echo -e "${GREEN}Weather Service deployed${NC}"
echo

# Step 5: Deploy API Service
echo -e "${YELLOW}[5/7] Deploying API Service...${NC}"
kubectl apply -f "$TMP_DIR/5-api-deployment.yaml"
kubectl wait --for=condition=available deployment/api-service --timeout=180s
echo -e "${GREEN}API Service deployed${NC}"
echo

# Step 6: Deploy Frontend
echo -e "${YELLOW}[6/7] Deploying Frontend...${NC}"
kubectl apply -f "$TMP_DIR/6-frontend-deployment.yaml"
kubectl wait --for=condition=available deployment/frontend --timeout=180s
echo -e "${GREEN}Frontend deployed${NC}"
echo

# Step 7: Deploy HPA
echo -e "${YELLOW}[7/7] Deploying Horizontal Pod Autoscaler...${NC}"
kubectl apply -f "$TMP_DIR/7-hpa.yaml"
echo -e "${GREEN}HPA configured${NC}"
echo

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo

# Display deployment status
echo -e "${BLUE}Deployment Status:${NC}"
kubectl get deployments
echo

echo -e "${BLUE}Service Status:${NC}"
kubectl get services
echo

echo -e "${YELLOW}Waiting for LoadBalancer external IPs to be assigned...${NC}"
echo "This may take 2-3 minutes..."
echo

# Wait for frontend LoadBalancer IP
for i in {1..60}; do
    FRONTEND_IP=$(kubectl get svc frontend -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "$FRONTEND_IP" ]; then
        break
    fi
    sleep 5
    echo -n "."
done
echo

if [ -n "$FRONTEND_IP" ]; then
    echo -e "${BLUE}Frontend URL:${NC} http://$FRONTEND_IP"
else
    echo -e "${YELLOW}Frontend IP not assigned yet. Check with:${NC}"
    echo "  kubectl get svc frontend"
fi

echo
echo -e "${BLUE}Demo Credentials:${NC}"
echo "  Email: demo@routegate.com"
echo "  Password: demo123"
echo

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
