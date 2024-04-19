/*
	Set Layer Pivots at the Center of Drawings
	
	A Toon Boom Harmony shelf script that sets layer pivot at the center of selected drawings based on each drawing's shapes at current frame.
	This script is compatible with Harmony 17.0.0 and up.
	
	
	Installation:
	
	1) Download and Unarchive the zip file.
	2) Locate to your user scripts folder (a hidden folder):
	   https://docs.toonboom.com/help/harmony-17/premium/scripting/import-script.html	
	   
	3) Add all unzipped files (*.js, and script-icons folder) directly to the folder above.
	4) Add ANM_Set_Layer_Pivots_At_Center_Of_Drawings to any toolbars.	
	
	
	Direction:

	1) Select one or more drawing nodes that you want to set its layer pivots to.	
	2) You can also select group nodes that contain drawings to process them in a batch.	
	3) Run ANM_Set_Layer_Pivots_At_Center_Of_Drawings.
	
	
	Additional Information:
	
	1) The script will set the layer pivot directly on the selected drawing node if the drawing node is set to be animatable by drawing tools.	   
	2) When the "Animate Using Animation Tool" option is turned off on the drawing node, this script sets a layer pivot on the drawing's parent peg.
	
	3) The layer pivot is also set on its parent peg if the drawing node is set to "Apply Embedded Pivot on Parent Peg" mode.

		
	Author:

		Yu Ueda (raindropmoment.com)
*/


var scriptVar = "1.01";


function ANM_Set_Layer_Pivots_At_Center_Of_Drawings()
{
	var sNodes = selection.selectedNodes();
	sNodes = getDrawings(sNodes); // filter all drawings in selection including sub nodes.
	if (sNodes.length == 0)
	{
		MessageBox.information("Please select at least one drawing node before running this script.\nYou can also select a group that contain multiple drawing nodes.");
		return;
	}

	scene.beginUndoRedoAccum("Set layer pivot(s) at the center of drawing(s)");


	for (var n in sNodes)
	{
		var curDrawing = sNodes[n];
		var pivotNode = curDrawing;		
		var boolAnimatable = node.getAttr(curDrawing, 1, "canAnimate").boolValue();
		var embeddedPivotOption = node.getTextAttr (curDrawing, 1, "useDrawingPivot");


		// In the following two cases, we need to set the layer pivot position on the current drawing's parent peg:
		// 1) "Animate Using Animation Tool" option is turned off on current drawing.
		// 2) Current drawing is set to "Apply Embedded Pivot on Parent Peg" mode.
		if (!boolAnimatable || (boolAnimatable && embeddedPivotOption === "Apply Embedded Pivot on Parent Peg"))
		{
			pivotNode = node.srcNode(curDrawing, 0);
			if (pivotNode === "")
			{
				MessageLog.trace(curDrawing + " is not animatable, and it does not have a parent peg to set its pivot position.");
				continue;
			}
			else if (node.type(pivotNode) !== "PEG")
			{
				pivotNode = traverseChainUpToFindPeg(pivotNode);
				if (pivotNode === "")
				{
					MessageLog.trace(curDrawing + " is not animatable, and it does not have a parent peg to set its pivot position.");
					continue;			
				}
			}
		}


		// Get the 2 opposing corners from each of 4 art layers' bounding box. Then pick the extreme position
		// from the results to get the 2 opposing corners of the entire drawing's bounding box.
		var fr = frame.current();	
		var corners = [{},{},{}];
		for (var at = 0; at < 4; at++)
		{
			var shapeInfo = {drawing: {node: curDrawing, frame: fr}, art: at};
			var box = Drawing.query.getBox(shapeInfo);
			if (box == false || "empty" in box)
				continue;
			
			else if (!("x" in corners[0])) // if corners array is empty
			{	
				corners[0].x = box.x0 /1875;
				corners[0].y = box.y0 /1875;			
				corners[1].x = box.x1 /1875;
				corners[1].y = box.y1 /1875;
			}
			else
			{	
				corners[0].x = Math.min(box.x0 /1875, corners[0].x);
				corners[0].y = Math.min(box.y0 /1875, corners[0].y);			
				corners[1].x = Math.max(box.x1 /1875, corners[1].x);
				corners[1].y = Math.max(box.y1 /1875, corners[1].y);
			}
		}
		if (!("x" in corners[0])) // if corners array is still empty
		{
			MessageLog.trace(curDrawing + " is empty at frame " + fr + ". Unable to set its layer pivot.");
			continue;
		}


		// Get the mid point of the 2 opposing corners' positions to use as the center point.
		var btmL_local_OGL = Point2d(corners[0].x, corners[0].y);	
		var topR_local_OGL = Point2d(corners[1].x, corners[1].y);		
		var center_local_OGL = midPointAt(btmL_local_OGL, topR_local_OGL, 0.5);


		// In the following two cases, we need to inverse the drawing pivot position from the center point:
		// 1) Setting layer pivot on the parent peg while current drawing is on "Apply Embedded Pivot on Parent Peg" mode.
		// 2) Setting layer pivot on the current drawing while it is on "Apply Embedded Pivot on Drawing Layer" mode.
		if (curDrawing !== pivotNode && embeddedPivotOption === "Apply Embedded Pivot on Parent Peg" ||
			curDrawing === pivotNode && embeddedPivotOption === "Apply Embedded Pivot on Drawing Layer")
		{
			node.setTextAttr(pivotNode, "pivot.x", 1, 0);
			node.setTextAttr(pivotNode, "pivot.y", 1, 0);	
			var drawPivot = node.getPivot(pivotNode, fr);
			
			// If drawing pivot is not at (0,0), inverse the position from the center point;		
			if (drawPivot.x !== 0 || drawPivot.y !== 0)
			{
				drawPivot_local_OGL = Point2d(scene.toOGLX(drawPivot.x), scene.toOGLY(drawPivot.y));			
				center_local_OGL = subtractBFromA(center_local_OGL, drawPivot_local_OGL);	
			}
		}
		

		// Set the center point as its layer pivot.
		node.setTextAttr(pivotNode, "pivot.x", 1, scene.fromOGLX(center_local_OGL.x));
		node.setTextAttr(pivotNode, "pivot.y", 1, scene.fromOGLY(center_local_OGL.y));		
	}

	scene.endUndoRedoAccum("");
	
	
	
	// Helper functions
	function getDrawings(nodeList)
	{
		var drawingList = [];		
		for (var i = 0; i < nodeList.length; i++)
		{
			var curNode = nodeList[i];		
			if (node.type(curNode) === "READ")
				drawingList.push(curNode);
			else if (node.type(curNode) === "GROUP")
			{
				var subNodeList = node.subNodes(curNode);
				var subDrawingList = getDrawings(subNodeList);
				drawingList.push.apply(drawingList, subDrawingList);
			}
		}
		return drawingList;
	}	
	
	function traverseChainUpToFindPeg(lastNode)
	{
		var numSubNodes = node.numberOfSubNodes(node.parentNode(lastNode));
		var src = node.srcNode(lastNode, 0);		
		for (var nd = 0; nd < numSubNodes; nd++)
		{
			if (src === "")
				return "";
	
			else if (node.type(src) === "PEG")
				return src;

			src = node.srcNode(src, 0);
		}
		return "";
	}
		
	function midPointAt(p1, p2, t)
	{
		var x = (p1.x *(1 -t) + p2.x *t);
		var y = (p1.y *(1 -t) + p2.y *t);
		return Point2d(parseFloat(x.toFixed(20)), parseFloat(y.toFixed(20)));
	}
	
	function subtractBFromA(p3d_A, p3d_B)
	{
		return Point2d(p3d_A.x - p3d_B.x, p3d_A.y - p3d_B.y);			
	}	
}